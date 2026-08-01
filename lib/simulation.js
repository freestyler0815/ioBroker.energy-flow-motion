/* eslint-disable prefer-const */
'use strict';

function parseNumOr(value, fallback) {
	const parsed = parseFloat(value);
	return Number.isFinite(parsed) ? parsed : fallback;
}

function isEsChannelEfmControlled(cfgTableEntry) {
	return !!(cfgTableEntry.esChannelEnabled && cfgTableEntry.esEfmControlEnabled);
}

/**
 * Rundet einen kW-Wert auf die dritte Nachkommastelle (1 W) - genauer lässt
 * sich die meiste aktuelle Speicher-Hardware ohnehin nicht ansteuern.
 */
function roundToWatt(valueKW) {
	return Math.round(valueKW * 1000) / 1000;
}

/**
 * Ein Simulationsschritt für einen Speicherkanal: nähert die simulierte
 * Ist-Leistung der Soll-Leistung nur schrittweise an (eigene, vom Regler
 * unabhängige Trägheit der simulierten Anlage) und integriert daraus den SoC.
 *
 * @param {number} prevLeistung   simulierte Leistung aus dem letzten Zyklus (+ = Laden, - = Entladen)
 * @param {number} sollLeistung   angeforderte Leistung dieses Zyklus (+ = Laden, - = Entladen)
 * @param {number} soc            aktueller simulierter SoC (%)
 * @param {number} minSoc
 * @param {number} maxSoc
 * @param {number} maxLadeleistung
 * @param {number} maxEntladeleistung
 * @param {number} capacityKWh
 * @param {number} maxSchrittKW   max. Leistungsänderung in diesem Zyklus (kW)
 * @param {number} dtSekunden
 * @returns {{leistung: number, soc: number}}
 */
function simulateStorageStep(prevLeistung, sollLeistung, soc, minSoc, maxSoc, maxLadeleistung, maxEntladeleistung, capacityKWh, maxSchrittKW, dtSekunden) {
	const kapazitaetLaden = soc < maxSoc ? maxLadeleistung : 0;
	const kapazitaetEntladen = soc > minSoc ? maxEntladeleistung : 0;
	const sollGeklemmt = Math.max(-kapazitaetEntladen, Math.min(kapazitaetLaden, sollLeistung));

	const delta = sollGeklemmt - prevLeistung;
	// Ziel liegt innerhalb eines Rampenschritts: exakten Wert übernehmen, statt
	// über prevLeistung + begrenztesDelta zu gehen (in Gleitkomma-Arithmetik
	// nicht garantiert exakt gleich sollGeklemmt). Reale Speicher-Hardware lässt
	// sich meist ohnehin nicht genauer als auf 1 W ansteuern.
	const neu = roundToWatt(
		Math.abs(delta) <= maxSchrittKW
			? sollGeklemmt
			: prevLeistung + Math.max(-maxSchrittKW, Math.min(maxSchrittKW, delta))
	);

	const deltaSoc = capacityKWh > 0 ? (neu * dtSekunden / 3600 / capacityKWh) * 100 : 0;
	const neueSoc = Math.min(100, Math.max(0, soc + deltaSoc));

	return { leistung: neu, soc: neueSoc };
}

/**
 * Kleiner Simulator für PV-Leistung und Last: legt dafür Eingabe-States unter
 * "<namespace>.simulation" an, die der Anwender von Hand setzt, und berechnet
 * daraus jeden Zyklus simulierte Werte für Netzeinspeisung/-bezug sowie für
 * jeden konfigurierten Speicherkanal SoC/Lade-/Entladeleistung.
 *
 * EFM-kontrollierte Speicher folgen dabei (mit eigener Trägheit) den Befehlen
 * aus energyStorageControlWaterfall(). Nicht EFM-kontrollierte ("fremde")
 * Speicher bilden eine einfache eigene Nulldurchgangs-Regelung nach, die
 * versucht, den nach den EFM-Speichern verbleibenden Netzsaldo auszugleichen.
 *
 * Die Regellogik des Adapters bleibt davon unberührt: um die Simulation zu
 * nutzen, müssen die bestehenden Datenquellen-Tabellen (PV/Last/Export/Import
 * sowie esSoC/esChargePower/esDischargePower je Speicherkanal) auf die hier
 * angelegten Objekte verweisen.
 */
class EnergyFlowSimulator {
	constructor(adapter) {
		this.adapter = adapter;
	}

	fullId(suffix) {
		return this.adapter.namespace + '.' + suffix;
	}

	async ensureFolder(suffix, name) {
		await this.adapter.setObjectNotExistsAsync(this.fullId(suffix), {
			type: 'folder',
			common: { name },
			native: {}
		});
	}

	async ensureNumberState(suffix, name, unit, writable) {
		await this.adapter.setObjectNotExistsAsync(this.fullId(suffix), {
			type: 'state',
			common: {
				name: name,
				type: 'number',
				role: writable ? 'level' : 'value',
				unit: unit,
				read: true,
				write: !!writable
			},
			native: {}
		});
	}

	async seedIfMissing(suffix, value) {
		const existing = await this.adapter.getStateAsync(this.fullId(suffix));
		if (!existing || existing.val == null) {
			await this.adapter.setStateAsync(this.fullId(suffix), { val: value, ack: true });
		}
	}

	async readNum(id) {
		try {
			const state = await this.adapter.getForeignStateAsync(id);
			if (state && state.val != null && Number.isFinite(state.val)) {
				return parseFloat(state.val.toString());
			}
		} catch (error) {
			this.adapter.log.error(error);
		}
		return 0;
	}

	async init() {
		if (!this.adapter.config.simulationActive) {
			return;
		}

		await this.ensureFolder('simulation', 'Simulation');
		await this.ensureNumberState('simulation.pvPower', 'Simulated PV Power (manual input)', 'kW', true);
		await this.ensureNumberState('simulation.loadPower', 'Simulated Base Load Power (manual input)', 'kW', true);
		await this.ensureNumberState('simulation.totalLoadPower', 'Simulated Total Load Power (base + active LoadPowerControl channels)', 'kW', false);
		await this.ensureNumberState('simulation.gridExport', 'Simulated Grid Export', 'kW', false);
		await this.ensureNumberState('simulation.gridImport', 'Simulated Grid Import', 'kW', false);

		await this.seedIfMissing('simulation.pvPower', 0);
		await this.seedIfMissing('simulation.loadPower', 0);
		await this.adapter.setStateAsync(this.fullId('simulation.totalLoadPower'), { val: 0, ack: true });
		await this.adapter.setStateAsync(this.fullId('simulation.gridExport'), { val: 0, ack: true });
		await this.adapter.setStateAsync(this.fullId('simulation.gridImport'), { val: 0, ack: true });

		const cfgTable = this.adapter.config.energyStorageControlChannels;
		if (Array.isArray(cfgTable) && cfgTable.some(row => row.esChannelTitle)) {
			await this.ensureFolder('simulation.storages', 'Simulated Storages');
			for (const row of cfgTable) {
				if (row.esChannelTitle) {
					await this.initStorage(row);
				}
			}
		}
	}

	async initStorage(row) {
		const base = 'simulation.storages.' + row.esChannelTitle;
		await this.ensureFolder(base, row.esChannelDescription || row.esChannelTitle);
		await this.ensureNumberState(base + '.soc', 'Simulated SoC', '%', true);
		await this.ensureNumberState(base + '.chargePower', 'Simulated Charge Power', 'kW', false);
		await this.ensureNumberState(base + '.dischargePower', 'Simulated Discharge Power', 'kW', false);

		const minSoc = parseNumOr(row.esSoCMin, 0);
		const maxSoc = parseNumOr(row.esSoCMax, 100);
		await this.seedIfMissing(base + '.soc', minSoc + (maxSoc - minSoc) / 2);
		await this.adapter.setStateAsync(this.fullId(base + '.chargePower'), { val: 0, ack: true });
		await this.adapter.setStateAsync(this.fullId(base + '.dischargePower'), { val: 0, ack: true });
	}

	async readEfmTarget(channelTitle) {
		const charge = await this.readNum(this.fullId('energyStorageControl.channels.' + channelTitle + '.chargePowerValue'));
		const discharge = await this.readNum(this.fullId('energyStorageControl.channels.' + channelTitle + '.dischargePowerValue'));
		return charge - discharge;
	}

	async stepStorage(row, sollLeistung, maxSchritt, dtSekunden, saldo) {
		const base = 'simulation.storages.' + row.esChannelTitle;
		const soc = await this.readNum(this.fullId(base + '.soc'));
		const prevCharge = await this.readNum(this.fullId(base + '.chargePower'));
		const prevDischarge = await this.readNum(this.fullId(base + '.dischargePower'));
		const prevLeistung = prevCharge - prevDischarge;

		const minSoc = parseNumOr(row.esSoCMin, 0);
		const maxSoc = parseNumOr(row.esSoCMax, 100);
		const maxLade = parseNumOr(row.esMaxChargePower, 0);
		const maxEntlade = parseNumOr(row.esMaxDischargePower, 0);
		const capacityKWh = parseNumOr(row.esCapacity, 0);

		const ergebnis = simulateStorageStep(
			prevLeistung, sollLeistung, soc, minSoc, maxSoc, maxLade, maxEntlade, capacityKWh, maxSchritt, dtSekunden
		);

		await this.adapter.setStateAsync(this.fullId(base + '.soc'), { val: ergebnis.soc, ack: true });
		await this.adapter.setStateAsync(this.fullId(base + '.chargePower'), { val: ergebnis.leistung > 0 ? ergebnis.leistung : 0, ack: true });
		await this.adapter.setStateAsync(this.fullId(base + '.dischargePower'), { val: ergebnis.leistung < 0 ? -ergebnis.leistung : 0, ack: true });

		return saldo - ergebnis.leistung;
	}

	/**
	 * Ein Simulationszyklus. Wird zu Beginn von updateValues() aufgerufen, bevor
	 * die normalen Sensor-Summen gelesen werden, damit diese (sofern auf
	 * simulation.* verweisend) bereits die frischen simulierten Werte sehen.
	 */
	async run() {
		if (!this.adapter.config.simulationActive) {
			return;
		}

		const cfgTable = this.adapter.config.energyStorageControlChannels;
		const rows = Array.isArray(cfgTable) ? cfgTable.filter(row => row.esChannelTitle) : [];

		const dtSekunden = parseInt(this.adapter.config.updateInterval) || 2;
		const maxSchritt = parseNumOr(this.adapter.config.simulationRampRate, 0.2) * dtSekunden;

		const pvPower = await this.readNum(this.fullId('simulation.pvPower'));
		const basisLast = await this.readNum(this.fullId('simulation.loadPower'));
		const pwcLast = await this.readNum(this.fullId('loadPowerControl.sumActiveLoad'));
		const totalLast = basisLast + pwcLast;

		let saldo = pvPower - totalLast;

		const efmRows = rows.filter(row => isEsChannelEfmControlled(row));
		const fremdRows = rows.filter(row => !isEsChannelEfmControlled(row));

		// Fremdspeicher versuchen eigenständig, den verbleibenden Saldo auf 0 zu bringen
		for (const row of fremdRows) {
			saldo = await this.stepStorage(row, saldo, maxSchritt, dtSekunden, saldo);
		}

		// EFM-Speicher folgen dem Regler-Kommando, unabhängig vom aktuellen Saldo
		for (const row of efmRows) {
			const target = await this.readEfmTarget(row.esChannelTitle);
			saldo = await this.stepStorage(row, target, maxSchritt, dtSekunden, saldo);
		}

		const gridExport = saldo > 0 ? saldo : 0;
		const gridImport = saldo < 0 ? -saldo : 0;

		await this.adapter.setStateAsync(this.fullId('simulation.totalLoadPower'), { val: totalLast, ack: true });
		await this.adapter.setStateAsync(this.fullId('simulation.gridExport'), { val: gridExport, ack: true });
		await this.adapter.setStateAsync(this.fullId('simulation.gridImport'), { val: gridImport, ack: true });
	}
}

module.exports = EnergyFlowSimulator;
module.exports.simulateStorageStep = simulateStorageStep;
