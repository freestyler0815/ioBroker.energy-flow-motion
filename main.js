/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-require-imports */
'use strict';

/*
 * Created with @iobroker/create-adapter v2.5.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
//import utils from '@iobroker/adapter-core';
const utils = require('@iobroker/adapter-core');

// Load your modules here, e.g.:
// const fs = require("fs");
const EnergyFlowSimulator = require('./lib/simulation.js');

class EnergyStats {
	constructor(date,load,pv,gridExport,gridImport,selfConsumption,batteryDischarge,batteryCharge,selfConsumptionQuota,autarchyQuota,timePeriod) {
		this.date = date;
		this.load = load;
		this.pv = pv;
		this.gridExport = gridExport;
		this.gridImport = gridImport;
		this.selfConsumption = selfConsumption;
		this.batteryDischarge = batteryDischarge;
		this.batteryCharge = batteryCharge;
		this.selfConsumptionQuota = selfConsumptionQuota;
		this.autarchyQuota = autarchyQuota;
		this.timePeriod = timePeriod;
		this.valueIDs = ['date','load','pv','export','import','selfConsumption','batteryDischarge','batteryCharge','selfConsumptionQuota','autarchyQuota'];
	}
	getDate() { return this.date; }
	getValueIDs() { return this.valueIDs; }
	resetValues(newDate) {	this.load = 0; this.pv = 0; this.gridExport = 0; this.gridImport = 0; this.selfConsumption = 0; this.batteryDischarge = 0; this.batteryCharge = 0; this.selfConsumptionQuota = 0; this.autarchyQuota = 0; this.date = newDate; }
	calcValues(pFloatPvPower, pFloatLoad, pFloatExport, pFloatImport, pFloatBatCharge, pFloatBatDischarge, pUpdateRate) {
		// Implementation for calculating energy values
		if ((pUpdateRate == 0) || (pUpdateRate == null)) {
			pUpdateRate = 2;
		}
		let vEnergyDivisor = 3600 / pUpdateRate;
		// Werte berechnen
		this.load = this.load + (pFloatLoad / vEnergyDivisor);
		this.pv = this.pv + (pFloatPvPower / vEnergyDivisor);
		this.gridExport = this.gridExport + (pFloatExport / vEnergyDivisor);
		this.gridImport = this.gridImport + (pFloatImport / vEnergyDivisor);
		this.selfConsumption = this.selfConsumption + ((pFloatPvPower - pFloatExport) / vEnergyDivisor);
		if (this.selfConsumption < 0) {
			this.selfConsumption = 0;
		}
		this.batteryDischarge = this.batteryDischarge + (pFloatBatDischarge / vEnergyDivisor);
		this.batteryCharge = this.batteryCharge + (pFloatBatCharge / vEnergyDivisor);
		if (this.pv == 0) {
			this.selfConsumptionQuota = 0;
		} else {
			this.selfConsumptionQuota = this.selfConsumption / this.pv * 100;
			if (this.selfConsumptionQuota > 100) {
				this.selfConsumptionQuota = 100;
			}
			if (this.selfConsumptionQuota < 0) {
				this.selfConsumptionQuota = 0;
			}
		}
		if (this.load == 0){
			this.autarchyQuota = 100;
		} else {
			this.autarchyQuota = (100 - (this.gridImport / this.load * 100));
			if (this.autarchyQuota > 100) {
				this.autarchyQuota = 100;
			}
			if (this.autarchyQuota < 0) {
				this.autarchyQuota = 0;
			}
		}
		return this;
	}
}

class PowerValues {
	constructor(pvPwrValue, loadPwrValue, exportPwrValue, importPwrValue, batChargePwrValue, batDischargePwrValue, batSoCValue, efmAdapter) {
		this.pvPwrValue = pvPwrValue;
		this.loadPwrValue = loadPwrValue;
		this.exportPwrValue = exportPwrValue;
		this.importPwrValue = importPwrValue;
		this.batChargePwrValue = batChargePwrValue;
		this.batDischargePwrValue = batDischargePwrValue;
		this.batSoCValue = batSoCValue;
		this.efmAdapter = efmAdapter;
		this.valueIDs = ['pvPwrValue','loadPwrValue','exportPwrValue','importPwrValue','batChargePwrValue','batDischargePwrValue','batSoCValue'];
	}
	getValueIDs() { return this.valueIDs; }
	async resetValues() { this.pvPwrValue = 0; this.loadPwrValue = 0; this.exportPwrValue = 0; this.importPwrValue = 0; this.batChargePwrValue = 0; this.batDischargePwrValue = 0; this.batSoCValue = 0; }
	async setValues(pvPwrValue, loadPwrValue, exportPwrValue, importPwrValue, batChargePwrValue, batDischargePwrValue, batSoCValue) {
		if ((exportPwrValue > 0) && (importPwrValue >0)) {
			if (exportPwrValue >= importPwrValue) {
				importPwrValue = 0;
			}
			else {
				exportPwrValue = 0;
			}
		}
		this.pvPwrValue = pvPwrValue;
		this.loadPwrValue = loadPwrValue;
		this.exportPwrValue = exportPwrValue;
		this.importPwrValue = importPwrValue;
		this.batChargePwrValue = batChargePwrValue;
		this.batDischargePwrValue = batDischargePwrValue;
		this.batSoCValue = batSoCValue;
	}
	async writeValues(){
		await this.efmAdapter.setStateAsync(this.efmAdapter.namespace + '.power.pvpower', {val: this.pvPwrValue, ack: true});
		await this.efmAdapter.setStateAsync(this.efmAdapter.namespace + '.power.load', {val: this.loadPwrValue, ack: true});
		await this.efmAdapter.setStateAsync(this.efmAdapter.namespace + '.power.export', {val: this.exportPwrValue, ack: true});
		await this.efmAdapter.setStateAsync(this.efmAdapter.namespace + '.power.import', {val: this.importPwrValue, ack: true});
		await this.efmAdapter.setStateAsync(this.efmAdapter.namespace + '.power.batteryCharge', {val: this.batChargePwrValue, ack: true});
		await this.efmAdapter.setStateAsync(this.efmAdapter.namespace + '.power.batteryDischarge', {val: this.batDischargePwrValue, ack: true});
		await this.efmAdapter.setStateAsync(this.efmAdapter.namespace + '.power.batterySoC', {val: this.batSoCValue, ack: true});
		this.efmAdapter.log.debug('PowerValuesObject written to States');
	}
	async calcPowerBudget() {
		const exportThreshold = parseFloat(this.efmAdapter.config.exportThreshold)/1000;
		const importThreshold = parseFloat(this.efmAdapter.config.importThreshold)/1000;
		if ((this.batDischargePwrValue > 0) && (this.importPwrValue > importThreshold)) {
			return (this.batDischargePwrValue + this.importPwrValue)*-1;
		}
		if ((this.batDischargePwrValue > 0) && (this.exportPwrValue > exportThreshold)) {
			return this.exportPwrValue - this.batDischargePwrValue;
		}
		if (this.batDischargePwrValue > 0) {
			return this.batDischargePwrValue*-1;
		}
		if (this.importPwrValue > importThreshold) {
			return this.importPwrValue*-1;
		}
		if (this.exportPwrValue > exportThreshold) {
			return this.exportPwrValue;
		}
		return 0;
	}
}

function parseNumOr(value, fallback) {
	const parsed = parseFloat(value);
	return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Rundet einen kW-Wert auf die dritte Nachkommastelle (1 W) - genauer lässt
 * sich die meiste aktuelle Speicher-Hardware ohnehin nicht ansteuern.
 */
function roundToWatt(valueKW) {
	return Math.round(valueKW * 1000) / 1000;
}

/**
 * Ein Speicherkanal gilt als von der Speichersteuerung (EFM) kontrolliert,
 * wenn er aktiviert ist und die EFM-Steuerung für ihn eingeschaltet ist.
 */
function isEsChannelEfmControlled(cfgTableEntry) {
	return !!(cfgTableEntry.esChannelEnabled && cfgTableEntry.esEfmControlEnabled);
}

/**
 * Gewichtete Wasserfall-Verteilung: verteilt `gesamt` (kW, >=0) proportional
 * zu den Gewichten auf die Speicher. Speicher, die ihr Limit (Kapazität)
 * erreichen, geben den Rest proportional zu den Gewichten der übrigen ab.
 *
 * @param {number} gesamt          Zu verteilende Leistung (>= 0)
 * @param {number[]} kapazitaeten  max. verfügbare Leistung je Speicher (>= 0)
 * @param {number[]} gewichte      relative Anteile je Speicher (>= 0)
 * @returns {number[]} zugewiesene Leistung je Speicher (gleiche Reihenfolge)
 */
function wasserfallVerteilungGewichtet(gesamt, kapazitaeten, gewichte) {
	const n = kapazitaeten.length;
	const ergebnis = new Array(n).fill(0);
	let rest = gesamt;

	let aktive = kapazitaeten
		.map((k, i) => ({ i, k, g: gewichte[i] }))
		.filter(x => x.k > 1e-9 && x.g > 0);

	while (rest > 1e-6 && aktive.length > 0) {
		const gewichtSumme = aktive.reduce((sum, x) => sum + x.g, 0);
		let restNeu = rest;
		const nochAktive = [];

		for (const { i, k, g } of aktive) {
			const anteil = rest * (g / gewichtSumme);
			const frei = k - ergebnis[i];

			if (anteil >= frei) {
				ergebnis[i] += frei;      // Speicher i ist jetzt am Limit
				restNeu -= frei;
			} else {
				ergebnis[i] += anteil;
				restNeu -= anteil;
				nochAktive.push({ i, k, g });
			}
		}
		rest = restNeu;
		aktive = nochAktive;
	}
	return ergebnis;
}

/**
 * Wie wasserfallVerteilungGewichtet, schließt aber Speicher aus, deren
 * fairer Anteil zwar >0, aber unterhalb ihrer Mindestleistung liegt.
 * Der dadurch frei werdende Anteil wird auf die übrigen Speicher verteilt.
 *
 * @param {number} gesamt
 * @param {number[]} kapazitaeten
 * @param {number[]} mindestleistungen  Mindestleistung je Speicher (>= 0)
 * @param {number[]} gewichte
 * @returns {number[]}
 */
function wasserfallVerteilungMitMindestleistung(gesamt, kapazitaeten, mindestleistungen, gewichte) {
	const n = kapazitaeten.length;
	const ausgeschlossen = new Array(n).fill(false);
	let ergebnis = new Array(n).fill(0);

	for (;;) {
		const aktiveKapazitaeten = kapazitaeten.map((k, i) => (ausgeschlossen[i] ? 0 : k));
		const teilergebnis = wasserfallVerteilungGewichtet(gesamt, aktiveKapazitaeten, gewichte);

		let neuAusgeschlossen = false;
		for (let i = 0; i < n; i++) {
			if (!ausgeschlossen[i] && teilergebnis[i] > 1e-9 && teilergebnis[i] < mindestleistungen[i]) {
				ausgeschlossen[i] = true;
				neuAusgeschlossen = true;
			}
		}

		if (!neuAusgeschlossen) {
			ergebnis = teilergebnis;
			break;
		}
	}
	return ergebnis;
}

/**
 * Gewicht eines Speichers fürs Entladen: die noch verfügbaren kWh bis minSoc
 * (aus aktuellem SoC und tatsächlicher kWh-Kapazität, NICHT maxLadeleistung/
 * maxEntladeleistung - das sind nur Leistungs-Obergrenzen in kW). Mehr
 * verfügbare kWh -> höheres Gewicht -> mehr Anteil, damit die größten
 * Speicher auch die meiste Energie entladen.
 */
function entladeGewicht(s, minGewicht) {
	const verfuegbareKWh = Math.max((s.soc - s.minSoc) / 100 * s.capacityKWh, 0);
	return Math.max(verfuegbareKWh, minGewicht);
}

/**
 * Gewicht eines Speichers fürs Laden: die noch freien kWh bis maxSoc (aus
 * aktuellem SoC und tatsächlicher kWh-Kapazität). Mehr freie kWh -> höheres
 * Gewicht -> mehr Anteil, damit die größten Speicher auch die meiste Energie
 * laden.
 */
function ladeGewicht(s, minGewicht) {
	const freieKWh = Math.max((s.maxSoc - s.soc) / 100 * s.capacityKWh, 0);
	return Math.max(freieKWh, minGewicht);
}

/**
 * Ein Regelzyklus der Wasserfall-Speichersteuerung.
 *
 * Als Eingang dient der Netz-Messpunkt (gridExport/gridImport) statt der
 * Differenz aus PV-Erzeugung und Last, da dieser zuverlässiger ist.
 *
 * @param {number} gridExport   Netzeinspeisung (kW, >= 0) = Überschuss
 * @param {number} gridImport   Netzbezug (kW, >= 0) = Bedarf/Defizit
 * @param {Array} speicherListe  je Speicher:
 *   {
 *     id, soc, minSoc, maxSoc,
 *     maxLadeleistung, minLadeleistung, maxEntladeleistung, minEntladeleistung,
 *     aktuelleLeistung   // Zustand aus letztem Zyklus! + = Laden, - = Entladen
 *   }
 * @param {number} dtSekunden          Zeit seit letztem Zyklus in Sekunden
 * @param {number} exportThresholdKW   Totband auf der Einspeiseseite (gleicher Schwellwert wie sonst im Adapter für "exportThreshold")
 * @param {number} importThresholdKW   Totband auf der Bezugsseite (gleicher Schwellwert wie sonst im Adapter für "importThreshold")
 * @param {number} rampeKwProS         max. Leistungsänderung je Speicher und Sekunde
 * @param {number} minGewicht          verhindert Gewicht = 0 bei SoC genau auf der Grenze
 * @param {number} fremdLadeleistung   aktuelle Ladeleistung der nicht EFM-kontrollierten Speicher (kW, >= 0);
 *                                     reduziert das Entladebudget der EFM-Speicher, damit diese nicht
 *                                     Energie zum Laden der Fremdspeicher liefern
 * @param {number} fremdEntladeleistung aktuelle Entladeleistung der nicht EFM-kontrollierten Speicher (kW, >= 0);
 *                                     reduziert das Ladebudget der EFM-Speicher, damit diese sich nicht
 *                                     aus den Fremdspeichern laden
 * @returns {Object} { einspeisung, bezug, speicher: [{id, leistung}] }
 *          leistung: + = Laden, - = Entladen (kW)
 */
function regelzyklusSchritt(gridExport, gridImport, speicherListe, dtSekunden, exportThresholdKW, importThresholdKW, rampeKwProS, minGewicht, fremdLadeleistung, fremdEntladeleistung) {
	let ueberschuss = gridExport - gridImport;

	if (ueberschuss > 0 && ueberschuss < exportThresholdKW) {
		ueberschuss = 0;
	} else if (ueberschuss < 0 && Math.abs(ueberschuss) < importThresholdKW) {
		ueberschuss = 0;
	}

	const n = speicherListe.length;
	// Default: aktuelle Leistung halten. ueberschuss ist die Rest-Einspeisung/-Bezug
	// NACH der aktuellen Speicherleistung (Feedback vom Netzzähler) - bei ueberschuss=0
	// absorbieren die Speicher also bereits genau den vorhandenen Überschuss/Bedarf.
	const zielLeistung = speicherListe.map(s => s.aktuelleLeistung || 0);

	if (ueberschuss > 0) {
		// Laden: nur Speicher, die noch nicht voll sind. Da ueberschuss der Rest NACH
		// der aktuellen Ladeleistung ist, ergibt sich das tatsächliche Gesamt-Ladeziel
		// aus aktueller Gesamt-Ladeleistung + ueberschuss (nicht ueberschuss allein -
		// sonst jagt der Regler einem durch das eigene Laden schrumpfenden Rest hinterher
		// und konvergiert bei ca. der Hälfte des verfügbaren Überschusses).
		const aktuelleGesamtLadeleistung = speicherListe.reduce((sum, s) => sum + Math.max(s.aktuelleLeistung || 0, 0), 0);
		const ladeZielGesamt = Math.max((ueberschuss - fremdEntladeleistung) + aktuelleGesamtLadeleistung, 0);
		const kapazitaeten = speicherListe.map(s => (s.soc < s.maxSoc ? s.maxLadeleistung : 0));
		const mindestleistungen = speicherListe.map(s => s.minLadeleistung);
		const gewichte = speicherListe.map(s => ladeGewicht(s, minGewicht));

		const verteilt = wasserfallVerteilungMitMindestleistung(ladeZielGesamt, kapazitaeten, mindestleistungen, gewichte);
		for (let i = 0; i < n; i++) zielLeistung[i] = verteilt[i];

	} else if (ueberschuss < 0) {
		// Entladen: analog zum Laden - Gesamt-Entladeziel = aktuelle Gesamt-Entladeleistung
		// + verbleibender Bedarf (ueberschuss ist bereits der Rest NACH der aktuellen
		// Entladeleistung).
		const aktuelleGesamtEntladeleistung = speicherListe.reduce((sum, s) => sum + Math.max(-(s.aktuelleLeistung || 0), 0), 0);
		const entladeZielGesamt = Math.max((Math.abs(ueberschuss) - fremdLadeleistung) + aktuelleGesamtEntladeleistung, 0);
		const kapazitaeten = speicherListe.map(s => (s.soc > s.minSoc ? s.maxEntladeleistung : 0));
		const mindestleistungen = speicherListe.map(s => s.minEntladeleistung);
		const gewichte = speicherListe.map(s => entladeGewicht(s, minGewicht));

		const verteilt = wasserfallVerteilungMitMindestleistung(entladeZielGesamt, kapazitaeten, mindestleistungen, gewichte);
		for (let i = 0; i < n; i++) zielLeistung[i] = -verteilt[i];
	}
	// bei ueberschuss === 0 bleibt zielLeistung auf dem zuletzt gehaltenen Wert (s.o.)

	// --- Rampenbegrenzung: aktuelle Leistung nur schrittweise annähern ---
	const maxSchritt = rampeKwProS * dtSekunden;
	const neueLeistung = new Array(n);

	for (let i = 0; i < n; i++) {
		const ist  = speicherListe[i].aktuelleLeistung || 0;
		const soll = zielLeistung[i];
		const delta = soll - ist;
		if (Math.abs(delta) <= maxSchritt) {
			// Ziel liegt innerhalb eines Rampenschritts: exakten Wert übernehmen,
			// statt über ist + begrenztesDelta zu gehen (das ist in Gleitkomma-
			// Arithmetik nicht garantiert exakt gleich soll).
			neueLeistung[i] = soll;
		} else {
			const begrenztesDelta = Math.max(-maxSchritt, Math.min(maxSchritt, delta));
			neueLeistung[i] = ist + begrenztesDelta;
		}
		// Reale Speicher-Hardware lässt sich meist nicht genauer als auf 1 W ansteuern.
		neueLeistung[i] = roundToWatt(neueLeistung[i]);
	}

	// ueberschuss ist nur der Rest NACH der bisherigen Speicherleistung; für den
	// tatsächlich verbleibenden Netzsaldo muss die bisherige (Vor-Zyklus-)Leistung
	// wieder hinzugerechnet werden, bevor die neue Speicherleistung abgezogen wird.
	const rohUeberschuss = ueberschuss + speicherListe.reduce((sum, s) => sum + (s.aktuelleLeistung || 0), 0);
	const gesamtSpeicherLeistungIst = neueLeistung.reduce((a, b) => a + b, 0);
	const restLeistung = rohUeberschuss - gesamtSpeicherLeistungIst;

	return {
		einspeisung: restLeistung > 0 ? restLeistung : 0,
		bezug: restLeistung < 0 ? -restLeistung : 0,
		speicher: speicherListe.map((s, i) => ({
			id: s.id,
			leistung: neueLeistung[i]
		}))
	};
}

class EnergyFlowMotion extends utils.Adapter {

	intervalId;
	refreshRate;

	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	constructor(options) {
		super({
			...options,
			name: 'energy-flow-motion',
		});
		this.on('ready', this.onReady.bind(this));
		//this.on('stateChange', this.onStateChange.bind(this));
		// this.on('objectChange', this.onObjectChange.bind(this));
		// this.on('message', this.onMessage.bind(this));
		this.on('unload', this.onUnload.bind(this));
		this.powerValues = new PowerValues(0,0,0,0,0,0,0,this);
		this.simulator = new EnergyFlowSimulator(this);
	}
	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		await this.initPowerControlChannels();
		await this.initEnergyStorageChannels();
		await this.simulator.init();
		this.refreshRate = parseInt(this.config.updateInterval)*1000;
		await this.updateValues();
		this.intervalId = this.setInterval( async () => {
			await this.updateValues();
		},this.refreshRate);

		// Initialize your adapter here

		// The adapters config (in the instance object everything under the attribute "native") is accessible via
		// this.config:
		//this.log.info('config option1: ' + this.config.option1);
		//this.log.info('config option2: ' + this.config.option2);

		/*
		For every state in the system there has to be also an object of type state
		Here a simple template for a boolean variable named "testVariable"
		Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
		*/
		/*
		await this.setObjectNotExistsAsync('testVariable', {
			type: 'state',
			common: {
				name: 'testVariable',
				type: 'boolean',
				role: 'indicator',
				read: true,
				write: true,
			},
			native: {},
		});
		*/
		// In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
		//this.subscribeStates('testVariable');
		// You can also add a subscription for multiple states. The following line watches all states starting with "lights."
		// this.subscribeStates('lights.*');
		// Or, if you really must, you can also watch all states. Don't do this if you don't need to. Otherwise this will cause a lot of unnecessary load on the system:
		// this.subscribeStates('*');

		/*
			setState examples
			you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
		*/
		// the variable testVariable is set to true as command (ack=false)
		//await this.setStateAsync('testVariable', true);

		// same thing, but the value is flagged "ack"
		// ack should be always set to true if the value is received from or acknowledged from the target system
		//await this.setStateAsync('testVariable', { val: true, ack: true });

		// same thing, but the state is deleted after 30s (getState will return null afterwards)
		//await this.setStateAsync('testVariable', { val: true, ack: true, expire: 30 });

		// examples for the checkPassword/checkGroup functions
		//let result = await this.checkPasswordAsync('admin', 'iobroker');
		//this.log.info('check user admin pw iobroker: ' + result);

		//result = await this.checkGroupAsync('admin', 'admin');
		//this.log.info('check group user admin group admin: ' + result);

	}

	async updateValues() {
		//this.log.info('RefreshRate:' + this.refreshRate);
		await this.simulator.run();
		let pvPwrValue = 0, loadPwrValue = 0, exportPwrValue = 0, importPwrValue = 0, batChargePwrValue = 0, batDischargePwrValue = 0, batSoCValue = 0;
		this.powerValues.resetValues();
		pvPwrValue = await this.getPvPowerSumValue();
		loadPwrValue = await this.getLoadPowerSumValue();
		exportPwrValue = await this.getGridExportPowerSumValue();
		importPwrValue = await this.getGridImportPowerSumValue();
		batChargePwrValue = await this.getBatteryChargePowerSumValue();
		batDischargePwrValue = await this.getBatteryDischargePowerSumValue();
		batSoCValue = await this.getBatterySoCSumValue();
		this.powerValues.setValues(pvPwrValue, loadPwrValue, exportPwrValue, importPwrValue, batChargePwrValue, batDischargePwrValue, batSoCValue);
		/*
		//if ((batChargePwrValue > 0) && (batDischargePwrValue > 0)) {
		//	if (batChargePwrValue >= batDischargePwrValue) {
		//		batDischargePwrValue = 0;
		//	}
		//	else {
		//		batChargePwrValue = 0;
		//	}
		//}
		*/
		//this.log.info('Namespace: ' + this.namespace);
		//Write current states and energy history to objects
		/*
		await this.setStateAsync(this.namespace + '.power.pvpower', {val: pvPwrValue, ack: true});
		await this.setStateAsync(this.namespace + '.power.load', {val: loadPwrValue, ack: true});
		await this.setStateAsync(this.namespace + '.power.export', {val: exportPwrValue, ack: true});
		await this.setStateAsync(this.namespace + '.power.import', {val: importPwrValue, ack: true});
		await this.setStateAsync(this.namespace + '.power.batteryCharge', {val: batChargePwrValue, ack: true});
		await this.setStateAsync(this.namespace + '.power.batteryDischarge', {val: batDischargePwrValue, ack: true});
		await this.setStateAsync(this.namespace + '.power.batterySoC', {val: batSoCValue, ack: true});
		*/
		await this.powerValues.writeValues();
		await this.efmCalcEnergyHistory(this.powerValues);
		//Control Energy Storage
		//await this.energyStorageControl(exportPwrValue, importPwrValue, batDischargePwrValue);
		//await this.energyStorageControl(this.powerValues);
		await this.energyStorageControlWaterfall(this.powerValues);

		//Control dynamic Load
		//await this.loadPowerControl(exportPwrValue, importPwrValue, batDischargePwrValue);
		await this.loadPowerControl(this.powerValues);
	}

	async getPvPowerSumValue(){
		const pwrValue = await this.getSumValuesFromCfgTables(this.config.pvPowerDataTable);
		this.log.debug('PvPowerSum: ' + pwrValue + ' kW');
		return pwrValue;
	}

	async getLoadPowerSumValue(){
		if (this.config.loadPowerCalculated) {
			// Energiebilanz: Last = PV-Leistung - Einspeisung + Bezug + Akkuentladung - Akkuladung
			const pvPwrValue = await this.getPvPowerSumValue();
			const exportPwrValue = await this.getGridExportPowerSumValue();
			const importPwrValue = await this.getGridImportPowerSumValue();
			const batChargePwrValue = await this.getBatteryChargePowerSumValue();
			const batDischargePwrValue = await this.getBatteryDischargePowerSumValue();
			let pwrValue = pvPwrValue - exportPwrValue + importPwrValue + batDischargePwrValue - batChargePwrValue;
			if (pwrValue < 0) {
				pwrValue = 0;
			}
			this.log.debug('LoadPowerSum (berechnet): ' + pwrValue + ' kW');
			return pwrValue;
		}
		const pwrValue = await this.getSumValuesFromCfgTables(this.config.loadDataTable);
		this.log.debug('LoadPowerSum: ' + pwrValue + ' kW');
		return pwrValue;
	}

	async getGridImportPowerSumValue(){
		const pwrValue = await this.getSumValuesFromCfgTables(this.config.importDataTable);
		this.log.debug('ImportPowerSum: ' + pwrValue + ' kW');
		return pwrValue;
	}

	async getGridExportPowerSumValue(){
		const pwrValue = await this.getSumValuesFromCfgTables(this.config.exportDataTable);
		this.log.debug('ExportPowerSum: ' + pwrValue + ' kW');
		return pwrValue;
	}

	async getBatteryChargePowerSumValue(){
		const pwrValue = await this.getSumChgPwrFromEsCfgTable(this.config.energyStorageControlChannels);
		this.log.debug('BatChargePowerSum: ' + pwrValue + ' kW');
		return pwrValue;
	}

	async getBatteryDischargePowerSumValue(){
		const pwrValue = await this.getSumDischgPwrFromEsCfgTable(this.config.energyStorageControlChannels);
		this.log.debug('BatDischargePowerSum: ' + pwrValue + ' kW');
		return pwrValue;
	}

	async getBatterySoCSumValue(){
		const cfgTable = this.config.energyStorageControlChannels;
		let socValue = 0;
		let counter = 0;
		if (cfgTable && Array.isArray(cfgTable)) {
			for (let p in cfgTable) {
				let cfgTableEntry = cfgTable[p];
				if (cfgTableEntry.esSoC) {
					let socObjId = cfgTableEntry.esSoC;
					try {
						let socState = await this.getForeignStateAsync(socObjId);
						if (socState && socState.val != null) {
							socValue += parseFloat(socState.val.toString());
							counter += 1;
						}
					} catch (error) {
						this.log.error(error);
					}
				}
			}
		}
		this.log.debug('BatSoCSum: ' + socValue/counter + ' %');
		return socValue/counter;
	}

	async getSumValuesFromCfgTables(cfgTable){
		let pwrValue = 0;
		if (cfgTable && Array.isArray(cfgTable)) {
			//this.log.info('Is Array');
			for (let p in cfgTable) {
				let cfgTableEntry = cfgTable[p];
				//this.log.info('Entry Selected');
				if (cfgTableEntry.pwrObjectId) {
					let pwrObjId = cfgTableEntry.pwrObjectId;
					let pwrFactor = parseFloat(cfgTableEntry.pwrFactor);
					//this.log.info('Entry Read');
					try {
						let powerState = await this.getForeignStateAsync(pwrObjId);
						if (powerState && powerState.val != null) {
							if (!Number.isFinite(powerState.val)){
							//if (isNaN(parseFloat((powerState.val.toString())))){
								pwrValue = 0;
							} else {
								if ((parseFloat(powerState.val.toString())*pwrFactor) < 0) {
									this.log.debug('Value for ' + cfgTableEntry.pwrObjectId + ' is negative (Calculated Value is: ' + parseFloat(powerState.val.toString())*pwrFactor +') setting Value to zero.');
								}
								pwrValue += parseFloat(powerState.val.toString())*pwrFactor;
								//this.log.info('Object: ' + pwrObjId + ' , PowerFactor:' + pwrFactor + ', PowerRead:' + pwrValue);
							}
						}
					} catch (error) {
						this.log.error(error);
					}
				}
			}
			//this.log.info('ConfigTable: ' + cfgTable + ' , SumPowerRead:' + pwrValue);
		}
		if (pwrValue < 0) {
			return 0;
		}
		else {
			return pwrValue;
		}
	}

	async getSumChgPwrFromEsCfgTable(cfgTable, filterFn){
		let pwrValue = 0;
		if (cfgTable && Array.isArray(cfgTable)) {
			//this.log.info('Is Array');
			for (let p in cfgTable) {
				let cfgTableEntry = cfgTable[p];
				//this.log.info('Entry Selected');
				if (filterFn && !filterFn(cfgTableEntry)) {
					continue;
				}
				if (cfgTableEntry.esChargePower) {
					let pwrObjId = cfgTableEntry.esChargePower;
					let pwrFactor = parseFloat(cfgTableEntry.esChgPwrFactor);
					//this.log.info('Entry Read');
					try {
						let powerState = await this.getForeignStateAsync(pwrObjId);
						if (powerState && powerState.val != null) {
							if (!Number.isFinite(powerState.val)){
								pwrValue = 0;
							} else {
								if ((parseFloat(powerState.val.toString())*pwrFactor) < 0) {
									this.log.debug('Value for ' + cfgTableEntry.esChargePower + ' is negative (Calculated Value is: ' + parseFloat(powerState.val.toString())*pwrFactor +') setting Value to zero.');
								} else {
									pwrValue += parseFloat(powerState.val.toString())*pwrFactor;
									this.log.debug('Object: ' + pwrObjId + ' , PowerFactor:' + pwrFactor + ', PowerRead:' + pwrValue);
								}
							}
						}
					} catch (error) {
						this.log.error(error);
					}
				}
			}
			//this.log.info('ConfigTable: ' + cfgTable + ' , SumPowerRead:' + pwrValue);
		}
		if (pwrValue < 0) {
			return 0;
		}
		else {
			return pwrValue;
		}
	}

	async getSumDischgPwrFromEsCfgTable(cfgTable, filterFn){
		let pwrValue = 0;
		if (cfgTable && Array.isArray(cfgTable)) {
			//this.log.info('Is Array');
			for (let p in cfgTable) {
				let cfgTableEntry = cfgTable[p];
				//this.log.info('Entry Selected');
				if (filterFn && !filterFn(cfgTableEntry)) {
					continue;
				}
				if (cfgTableEntry.esDischargePower) {
					let pwrObjId = cfgTableEntry.esDischargePower;
					let pwrFactor = parseFloat(cfgTableEntry.esDischgPwrFactor);
					//this.log.info('Entry Read');
					try {
						let powerState = await this.getForeignStateAsync(pwrObjId);
						if (powerState && powerState.val != null) {
							if (!Number.isFinite(powerState.val)){
								pwrValue = 0;
							} else {
								if ((parseFloat(powerState.val.toString())*pwrFactor) < 0) {
									this.log.debug('Value for ' + cfgTableEntry.esDischargePower + ' is negative (Calculated Value is: ' + parseFloat(powerState.val.toString())*pwrFactor +') setting Value to zero.');
								} else {
									pwrValue += parseFloat(powerState.val.toString())*pwrFactor;
									//this.log.info('Object: ' + pwrObjId + ' , PowerFactor:' + pwrFactor + ', PowerRead:' + pwrValue);
								}
							}
						}
					} catch (error) {
						this.log.error(error);
					}
				}
			}
			//this.log.info('ConfigTable: ' + cfgTable + ' , SumPowerRead:' + pwrValue);
		}
		if (pwrValue < 0) {
			return 0;
		}
		else {
			return pwrValue;
		}
	}

	async getEnergyCounterTimePeriod() {
		const sEfmPathTimePeriod = ['day'];
		if (this.config.energyCounterMonthActive) {
			sEfmPathTimePeriod.push('month');
		}
		if (this.config.energyCounterYearActive) {
			sEfmPathTimePeriod.push('year');
		}
		return sEfmPathTimePeriod;
	}

	async getValueIDs() {
		const sEfmValueIDs = ['date','load','pv','export','import','selfConsumption','batteryDischarge','batteryCharge','selfConsumptionQuota','autarchyQuota'];
		return sEfmValueIDs;
	}

	async getEnergyPathLive() {
		const sPathEnergyValues = this.namespace + '.energy.live';
		return sPathEnergyValues;
	}

	async getEnergyPathHistory() {
		const sPathEnergyValues = this.namespace + '.energy.history';
		return sPathEnergyValues;
	}

	async efmCalcEnergyHistory (pPowerValues)  {
		let energyStats = [new EnergyStats()];
		let pFloatPvPower = pPowerValues.pvPwrValue;
		let pFloatLoad = pPowerValues.loadPwrValue;
		let pFloatExport = pPowerValues.exportPwrValue;
		let pFloatImport = pPowerValues.importPwrValue;
		let pFloatBatCharge = pPowerValues.batChargePwrValue;
		let pFloatBatDischarge = pPowerValues.batDischargePwrValue;
		let pEfmPathTimePeriod = await this.getEnergyCounterTimePeriod();
		let updateRate = parseInt(this.config.updateInterval);
		for (let i = 0; i < pEfmPathTimePeriod.length; i++) {
			// aktuelle Energiezählerstände einlesen
			energyStats[i] = await this.readValuesAsObjects(pEfmPathTimePeriod[i]);
			// Zählerstandhistorie managen (Tageswechsel etc. historische Zählerstände neu schreiben)
			energyStats[i] = await this.historyManageV2(energyStats[i]);
			// aktuelle Zählerstände berechnen
			this.log.debug('pPowerValues.pvPwrValue: ' + pPowerValues.pvPwrValue + ' kW');
			this.log.debug('pPowerValues.batChargePwrValue: ' + pPowerValues.batChargePwrValue + ' kW');
			this.log.debug('pPowerValues.batDischargePwrValue: ' + pPowerValues.batDischargePwrValue + ' kW');
			energyStats[i] = await energyStats[i].calcValues(pFloatPvPower, pFloatLoad, pFloatExport, pFloatImport, pFloatBatCharge, pFloatBatDischarge, updateRate);
			// Zählerstände in States schreiben
			await this.writeValuesV2(energyStats[i]);
		}
		//let vEfmValues = await this.readValues();
		//vEfmValues = await this.historyManage(vEfmValues);
		// aktuelle Zählerstände berechnen
		//const vEfmCalcValues = await this.calcValues(pFloatPvPower, pFloatLoad, pFloatExport, pFloatImport, pFloatBatCharge, pFloatBatDischarge,vEfmValues);
		// Zählerstände in States schreiben
		//await this.writeValues(vEfmCalcValues);
	}

	async readValuesAsObjects(timePeriod) {
		let energyStats = new EnergyStats();
		let sPathEnergyValues = await this.getEnergyPathLive();
		let sEfmCurrPath = '';
		energyStats.timePeriod = timePeriod;
		sEfmCurrPath = sPathEnergyValues + '.' + timePeriod + '.';
		//'date','load','pv','export','import','selfConsumption','batteryDischarge','batteryCharge','selfConsumptionQuota','autarchyQuota'
		try {
			let stateObjectDate = await this.getStateAsync(sEfmCurrPath + 'date');
			let stateObjectLoad = await this.getStateAsync(sEfmCurrPath + 'load');
			let stateObjectPv = await this.getStateAsync(sEfmCurrPath + 'pv');
			let stateObjectExport = await this.getStateAsync(sEfmCurrPath + 'export');
			let stateObjectImport = await this.getStateAsync(sEfmCurrPath + 'import');
			let stateObjectSelfConsumption = await this.getStateAsync(sEfmCurrPath + 'selfConsumption');
			let stateObjectBatteryDischarge = await this.getStateAsync(sEfmCurrPath + 'batteryDischarge');
			let stateObjectBatteryCharge = await this.getStateAsync(sEfmCurrPath + 'batteryCharge');
			let stateObjectSelfConsumptionQuota = await this.getStateAsync(sEfmCurrPath + 'selfConsumptionQuota');
			let stateObjectAutarchyQuota = await this.getStateAsync(sEfmCurrPath + 'autarchyQuota');
			// Check if Data was loaded from Objects and write to EnergyStats Object
			if (stateObjectDate && stateObjectDate.val != null) {
				if (typeof stateObjectDate.val === 'string') {
					energyStats.date = new Date (stateObjectDate.val);
				} else {
					energyStats.date = stateObjectDate.val;
				}
			}

			if (stateObjectLoad && stateObjectLoad.val != null) {
				energyStats.load = stateObjectLoad.val;
			} else {
				energyStats.load = 0;
			}

			if (stateObjectPv && stateObjectPv.val != null) {
				energyStats.pv = stateObjectPv.val;
			} else {
				energyStats.pv = 0;
			}

			if (stateObjectExport && stateObjectExport.val != null) {
				energyStats.gridExport = stateObjectExport.val;
			} else {
				energyStats.gridExport = 0;
			}

			if (stateObjectImport && stateObjectImport.val != null) {
				energyStats.gridImport = stateObjectImport.val;
			} else {
				energyStats.gridImport = 0;
			}

			if (stateObjectSelfConsumption && stateObjectSelfConsumption.val != null) {
				energyStats.selfConsumption = stateObjectSelfConsumption.val;
			} else {
				energyStats.selfConsumption = 0;
			}

			if (stateObjectBatteryDischarge && stateObjectBatteryDischarge.val != null) {
				energyStats.batteryDischarge = stateObjectBatteryDischarge.val;
			} else {
				energyStats.batteryDischarge = 0;
			}

			if (stateObjectBatteryCharge && stateObjectBatteryCharge.val != null) {
				energyStats.batteryCharge = stateObjectBatteryCharge.val;
			} else {
				energyStats.batteryCharge = 0;
			}

			if (stateObjectSelfConsumptionQuota && stateObjectSelfConsumptionQuota.val != null) {
				energyStats.selfConsumptionQuota = stateObjectSelfConsumptionQuota.val;
			} else {
				energyStats.selfConsumptionQuota = 0;
			}

			if (stateObjectAutarchyQuota && stateObjectAutarchyQuota.val != null) {
				energyStats.autarchyQuota = stateObjectAutarchyQuota.val;
			} else {
				energyStats.autarchyQuota = 0;
			}
		} catch (error) {
			this.log.error(error);
		}
		return energyStats;
	}

	async historyManageV2(energyStats) {
		let sEnergyPathHistory = await this.getEnergyPathHistory();
		let sEfmCurrPath = '';
		let vCalcDate = new Date (energyStats.date.valueOf());
		let now = new Date();
		let newDate = new Date();
		newDate.setHours(0,0,30,0);
		switch (energyStats.timePeriod) {
			case 'day':
				vCalcDate.setDate(vCalcDate.getDate() + 1);
				break;
			case 'month':
				if (this.config.energyCounterMonthActive) {
					now.setDate(1);
					vCalcDate.setDate(1);
					vCalcDate.setMonth(vCalcDate.getMonth() + 1);
				}
				break;
			case 'year':
				if (this.config.energyCounterYearActive) {
					now.setDate(1);
					now.setMonth(0);
					vCalcDate.setDate(1);
					vCalcDate.setMonth(0);
					vCalcDate.setFullYear(vCalcDate.getFullYear() + 1);
				}
				break;
		}
		//'date','load','pv','export','import','selfConsumption','batteryDischarge','batteryCharge','selfConsumptionQuota','autarchyQuota'
		if (now.valueOf() >= vCalcDate.valueOf()) {
			sEfmCurrPath = sEnergyPathHistory + '.' + energyStats.timePeriod + '.';
			await this.setStateAsync(sEfmCurrPath + 'date',energyStats.date.valueOf(),true);
			await this.setStateAsync(sEfmCurrPath + 'load',energyStats.load,true);
			await this.setStateAsync(sEfmCurrPath + 'pv',energyStats.pv,true);
			await this.setStateAsync(sEfmCurrPath + 'export',energyStats.gridExport,true);
			await this.setStateAsync(sEfmCurrPath + 'import',energyStats.gridImport,true);
			await this.setStateAsync(sEfmCurrPath + 'selfConsumption',energyStats.selfConsumption,true);
			await this.setStateAsync(sEfmCurrPath + 'batteryDischarge',energyStats.batteryDischarge,true);
			await this.setStateAsync(sEfmCurrPath + 'batteryCharge',energyStats.batteryCharge,true);
			await this.setStateAsync(sEfmCurrPath + 'selfConsumptionQuota',energyStats.selfConsumptionQuota,true);
			await this.setStateAsync(sEfmCurrPath + 'autarchyQuota',energyStats.autarchyQuota,true);
			energyStats.resetValues(newDate);
			this.log.debug('Reset ' + energyStats.timePeriod + ' Counter executed');
		}
		return energyStats;
	}

	async writeValuesV2(energyStats) {
		let sEnergyPathLive = await this.getEnergyPathLive();
		let sEfmCurrPath = '';
		// Werte schreiben
		try {
			sEfmCurrPath = sEnergyPathLive + '.' + energyStats.timePeriod + '.';
			await this.setStateAsync(sEfmCurrPath + 'date',energyStats.date.valueOf(),true);
			await this.setStateAsync(sEfmCurrPath + 'load',energyStats.load,true);
			await this.setStateAsync(sEfmCurrPath + 'pv',energyStats.pv,true);
			await this.setStateAsync(sEfmCurrPath + 'export',energyStats.gridExport,true);
			await this.setStateAsync(sEfmCurrPath + 'import',energyStats.gridImport,true);
			await this.setStateAsync(sEfmCurrPath + 'selfConsumption',energyStats.selfConsumption,true);
			await this.setStateAsync(sEfmCurrPath + 'batteryDischarge',energyStats.batteryDischarge,true);
			await this.setStateAsync(sEfmCurrPath + 'batteryCharge',energyStats.batteryCharge,true);
			await this.setStateAsync(sEfmCurrPath + 'selfConsumptionQuota',energyStats.selfConsumptionQuota,true);
			await this.setStateAsync(sEfmCurrPath + 'autarchyQuota',energyStats.autarchyQuota,true);
		}
		catch(error) {
			this.log.error(error + ' EnergyStatsTimeperiod: ' + energyStats.timePeriod);
		}
		this.log.debug('writevalues executed');
	}

	async initPowerControlChannels() {
		this.log.info('PowerControlInitChannels started');
		let cfgTable = this.config.powerControlChannels;
		let counter = 0;
		await this.setStateAsync(this.namespace + '.loadPowerControl.sumActiveLoad', {val: 0, ack: true});
		if (this.supportsFeature && this.supportsFeature('ADAPTER_DEL_OBJECT_RECURSIVE')) {
			await this.delObjectAsync(this.namespace + '.loadPowerControl.channels', { recursive: true });
		}
		if (cfgTable && Array.isArray(cfgTable)) {
			this.log.info('PowerControlInitChannels started');
			for (let p in cfgTable) {
				let cfgTableEntry = cfgTable[p];
				//ToDo: Fehlermeldung für leeren Title einbauen
				if (cfgTableEntry.pwcChannelTitle) {
					this.log.info('PowerControlInitChannel: ' + cfgTableEntry.pwcChannelTitle);
					counter +=1;
					await this.createObjectTreeLPC(cfgTableEntry,counter);
					//let channelPrefix = this.leadingZero(counter,3);
					//let socObjId = cfgTableEntry.socObjectId;
					//let pwrFactor = parseFloat(cfgTableEntry.pwrFactor);
				}
			}
		}
		//this.log.debug('BatSoCSum: ' + socValue/counter + ' %');
	}

	async createObjectTreeLPC(cfgTableEntry,priority) {
		/*
		await this.setObjectNotExistsAsync(this.namespace + '.loadPowerControl.' + cfgTableEntry.pwcChannelTitle , {
			type: 'state',
			common: {
				name: 'testVariable',
				type: 'boolean',
				role: 'indicator',
				read: true,
				write: true,
			},
			native: {},
		});*/
		await this.setObjectNotExistsAsync(this.namespace + '.loadPowerControl.channels', {
			type: 'folder',
			common: {
				name: 'Load Power Control Channels'
			},
			native: {},
		});
		await this.setObjectNotExistsAsync(this.namespace + '.loadPowerControl.channels.' + cfgTableEntry.pwcChannelTitle , {
			type: 'folder',
			common: {
				name: cfgTableEntry.pwcChannelDescription
			},
			native: {},
		});
		await this.setObjectNotExistsAsync(this.namespace + '.loadPowerControl.channels.' + cfgTableEntry.pwcChannelTitle + '.priority' , {
			type: 'state',
			common: {
				name: 'Priority',
				type: 'number',
				role: 'value',
				read: true,
				write: true,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync(this.namespace + '.loadPowerControl.channels.' + cfgTableEntry.pwcChannelTitle + '.active' , {
			type: 'state',
			common: {
				name: 'Active',
				type: 'boolean',
				role: 'indicator',
				read: true,
				write: true,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync(this.namespace + '.loadPowerControl.channels.' + cfgTableEntry.pwcChannelTitle + '.powerOn' , {
			type: 'state',
			common: {
				name: 'PowerOn',
				type: 'boolean',
				role: 'switch.power',
				read: true,
				write: true,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync(this.namespace + '.loadPowerControl.channels.' + cfgTableEntry.pwcChannelTitle + '.powerValue' , {
			type: 'state',
			common: {
				name: 'PowerValue',
				type: 'number',
				role: 'value',
				unit: 'kW',
				read: true,
				write: true,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync(this.namespace + '.loadPowerControl.channels.' + cfgTableEntry.pwcChannelTitle + '.shutdownDelay' , {
			type: 'state',
			common: {
				name: 'ShutdownDelay',
				type: 'number',
				role: 'value',
				unit: 's',
				read: true,
				write: true,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync(this.namespace + '.loadPowerControl.channels.' + cfgTableEntry.pwcChannelTitle + '.activationDelay' , {
			type: 'state',
			common: {
				name: 'ActivationDelay',
				type: 'number',
				role: 'value',
				read: true,
				write: true,
			},
			native: {},
		});
		await this.setStateAsync(this.namespace + '.loadPowerControl.channels.' + cfgTableEntry.pwcChannelTitle + '.priority', {val: priority, ack: true});
		await this.setStateAsync(this.namespace + '.loadPowerControl.channels.' + cfgTableEntry.pwcChannelTitle + '.active', {val: cfgTableEntry.pwcChannelEnabled, ack: true});
		await this.setStateAsync(this.namespace + '.loadPowerControl.channels.' + cfgTableEntry.pwcChannelTitle + '.powerOn', {val: false, ack: true});
		await this.setStateAsync(this.namespace + '.loadPowerControl.channels.' + cfgTableEntry.pwcChannelTitle + '.powerValue', {val: 0, ack: true});
		await this.setStateAsync(this.namespace + '.loadPowerControl.channels.' + cfgTableEntry.pwcChannelTitle + '.shutdownDelay', {val: parseFloat(cfgTableEntry.pwcChannelShutdownDelay), ack: true});
		await this.setStateAsync(this.namespace + '.loadPowerControl.channels.' + cfgTableEntry.pwcChannelTitle + '.activationDelay', {val: parseFloat(cfgTableEntry.pwcChannelActivationDelay), ack: true});
	}

	//this function is the main function to control the loadPowerChannels
	//async loadPowerControl(pFloatExport, pFloatImport, pFloatBatDischarge) {
	async loadPowerControl(pPowerValues) {
		//loadPowerControl active?
		//this.log.info('loadPowerControl');
		if (this.config.powerControlActive) {
			let powerBudget = await pPowerValues.calcPowerBudget();
			//this.log.info('Powerbudget: '+powerBudget);
			let cfgTable = this.config.powerControlChannels;
			let sumPowerConsumption = 0;
			let dynamicLoadDecreaseActive = false;
			//Check if Powercontrolchannels exists in the setup
			if (cfgTable && Array.isArray(cfgTable)) {
				//powerBudget > 0, activate loadPowerChannels to consume the energy
				if (powerBudget > 0 && !(await this.areEnergyStoragesSaturated())) {
					// Die Energiespeicher haben noch freie Ladekapazität und laden noch
					// nicht mit voller Leistung: der Überschuss bleibt für sie reserviert,
					// LoadPowerControl-Kanäle werden dieses Mal nicht (weiter) aktiviert.
					this.log.debug('loadPowerControl: Überschuss bleibt für die Speicherladung reserviert, keine Aktivierung von LoadPowerControl-Kanälen.');
				} else if (powerBudget > 0) {
					for (let p in cfgTable) {
						let cfgTableEntry = cfgTable[p];
						if (cfgTableEntry.pwcChannelEnabled) {
							let maxPower = cfgTableEntry.pwcChannelMaxPower;
							let minPower = cfgTableEntry.pwcChannelMinPower;
							let powerStepSize = cfgTableEntry.pwcChannelStepSize;
							let shutdownDelay = cfgTableEntry.pwcChannelShutdownDelay;
							let activePowerConsumptionValue = await this.getPwcActivePowerConsumptionValue(cfgTableEntry.pwcChannelTitle);
							//current channel active power consumption = 0
							if (activePowerConsumptionValue == 0) {
								// static channel
								if ((maxPower == minPower) && (powerStepSize == 0)) {
									if (minPower <= powerBudget) {
										//activate powerChannel
										if (await this.activatePwcChannel(cfgTableEntry.pwcChannelTitle,minPower,shutdownDelay)) {
											powerBudget -= minPower;
											sumPowerConsumption += minPower;
										}
									}
								// dynamic channel
								} else if ((maxPower > minPower) && (powerStepSize > 0)) {
									if (minPower <= powerBudget) {
										let powerTarget = minPower;
										while (powerTarget + powerStepSize <= powerBudget) {
											powerTarget += powerStepSize;
										}
										if (await this.activatePwcChannel(cfgTableEntry.pwcChannelTitle,powerTarget,shutdownDelay)) {
											powerBudget -= powerTarget;
											sumPowerConsumption += powerTarget;
										}
									}
								}
							// powerChannel already active, check if it is a dynamic channel
							} else if ((maxPower > minPower) && (powerStepSize > 0)) {
								if (powerStepSize <= powerBudget) {
									// increase powerconsumption of dynamic channel
									let newPowerConsumption = await this.increasePowerPwcChannel(cfgTableEntry.pwcChannelTitle,powerStepSize,maxPower,shutdownDelay,powerBudget);
									powerBudget -= newPowerConsumption;
									sumPowerConsumption += newPowerConsumption;
								} else {
									sumPowerConsumption += activePowerConsumptionValue;
								}
							} else {
								sumPowerConsumption += activePowerConsumptionValue;
							}
						}
					}
					// set current sum of powerconsumption of all channels
					await this.setStateAsync(this.namespace + '.loadPowerControl.sumActiveLoad', {val: sumPowerConsumption, ack: true});
				}
				// decrease or deactivate the powerconsumption of dynamic or static powerChannels
				else if (powerBudget < 0) {
					let tabelCounter = cfgTable.length;
					for (let i = tabelCounter - 1; i >= 0; i--) {
						let cfgTableEntry = cfgTable[i];
						if (cfgTableEntry.pwcChannelEnabled) {
							let maxPower = cfgTableEntry.pwcChannelMaxPower;
							let minPower = cfgTableEntry.pwcChannelMinPower;
							let powerStepSize = cfgTableEntry.pwcChannelStepSize;
							//let shutdownDelay = cfgTableEntry.pwcChannelShutdownDelay;
							let activationDelay = cfgTableEntry.pwcChannelActivationDelay;
							let activePowerConsumptionValue = await this.getPwcActivePowerConsumptionValue(cfgTableEntry.pwcChannelTitle);
							if (activePowerConsumptionValue > 0) {
								if ((maxPower == minPower) && (powerStepSize == 0)) {
									if (dynamicLoadDecreaseActive == false) {
										if (await this.deactivatePwcChannel(cfgTableEntry.pwcChannelTitle,activationDelay)) {
											powerBudget += activePowerConsumptionValue;
										} else {
											sumPowerConsumption += activePowerConsumptionValue;
										}
									} else {
										sumPowerConsumption += activePowerConsumptionValue;
									}
								} else if ((maxPower > minPower) && (powerStepSize > 0)) {
									dynamicLoadDecreaseActive = true;
									if (activePowerConsumptionValue > minPower) {
										let newPowerConsumption = await this.decreasePowerPwcChannel(cfgTableEntry.pwcChannelTitle,powerStepSize,minPower,powerBudget);
										powerBudget += newPowerConsumption;
										sumPowerConsumption += newPowerConsumption;
									} else {
										if (await this.deactivatePwcChannel(cfgTableEntry.pwcChannelTitle,activationDelay)) {
											powerBudget += activePowerConsumptionValue;
										} else {
											sumPowerConsumption += activePowerConsumptionValue;
										}
									}
								}

							}

						}
					}
					await this.setStateAsync(this.namespace + '.loadPowerControl.sumActiveLoad', {val: sumPowerConsumption, ack: true});
				} else {
					await this.resetShutdownDelays(cfgTable);
					await this.resetActivationDelays(cfgTable);
				}
			}
		}
	}

	async activatePwcChannel(pwcChannelTitle,powerValue,shutdownDelay) {
		let activationDelayValue = await this.getPwcActivationDelay(pwcChannelTitle);
		//let updateInterval = parseInt(this.config.updateInterval);
		if (activationDelayValue <= 0) {
			this.log.debug('activate pwc');
			let shutdownDelayValue = await this.getPwcConfigShutDownDelay(pwcChannelTitle);
			await this.setStateAsync(this.namespace + '.loadPowerControl.channels.' + pwcChannelTitle + '.powerValue', {val: powerValue, ack: true});
			await this.setStateAsync(this.namespace + '.loadPowerControl.channels.' + pwcChannelTitle + '.powerOn', {val: true, ack: true});
			if (shutdownDelay > shutdownDelayValue) {
				await this.setStateAsync(this.namespace + '.loadPowerControl.channels.' + pwcChannelTitle + '.shutdownDelay', {val: shutdownDelay, ack: true});
			}
			return true;
		} else {
			this.log.debug('activation delay');
			activationDelayValue -= 1;
			await this.setStateAsync(this.namespace + '.loadPowerControl.channels.' + pwcChannelTitle + '.activationDelay', {val: activationDelayValue, ack: true});
			return false;
		}
	}

	async increasePowerPwcChannel(pwcChannelTitle,powerStepSize,maxPower,shutdownDelay,powerBudget) {
		let shutdownDelayValue = await this.getPwcShutDownDelay(pwcChannelTitle);
		let activePowerConsumptionValue = await this.getPwcActivePowerConsumptionValue(pwcChannelTitle);
		let powerTarget = 0;
		while (powerTarget + powerStepSize <= powerBudget) {
			powerTarget += powerStepSize;
		}
		let newPowerConsumption = activePowerConsumptionValue + powerTarget;
		if (newPowerConsumption > maxPower) {
			newPowerConsumption = maxPower;
		}
		await this.setStateAsync(this.namespace + '.loadPowerControl.channels.' + pwcChannelTitle + '.powerValue', {val: newPowerConsumption, ack: true});
		if (shutdownDelay > shutdownDelayValue) {
			await this.setStateAsync(this.namespace + '.loadPowerControl.channels.' + pwcChannelTitle + '.shutdownDelay', {val: shutdownDelay, ack: true});
		}
		return newPowerConsumption;
	}

	async decreasePowerPwcChannel(pwcChannelTitle,powerStepSize,minPower,powerBudget) {
		let activePowerConsumptionValue = await this.getPwcActivePowerConsumptionValue(pwcChannelTitle);
		let powerTarget = 0;
		while (powerTarget >= powerBudget) {
			powerTarget -= powerStepSize;
		}
		let newPowerConsumption = activePowerConsumptionValue + powerTarget;
		if (newPowerConsumption < 0) {
			newPowerConsumption = 0;
		}
		if (newPowerConsumption < minPower) {
			newPowerConsumption = minPower;
		}
		await this.setStateAsync(this.namespace + '.loadPowerControl.channels.' + pwcChannelTitle + '.powerValue', {val: newPowerConsumption, ack: true});
		return newPowerConsumption;
	}

	async deactivatePwcChannel(pwcChannelTitle,activationDelay) {
		let shutdownDelayValue = await this.getPwcShutDownDelay(pwcChannelTitle);
		//let activationDelay = parseInt(this.config.powerControlActivationDelay);
		//let activationDelay = await this.getPwcConfigActivationDelay(pwcChannelTitle);
		let updateInterval = parseInt(this.config.updateInterval);
		if (shutdownDelayValue - updateInterval > 0) {
			shutdownDelayValue -= updateInterval;
			await this.setStateAsync(this.namespace + '.loadPowerControl.channels.' + pwcChannelTitle + '.shutdownDelay', {val: shutdownDelayValue, ack: true});
			return false;
		} else {
			await this.setStateAsync(this.namespace + '.loadPowerControl.channels.' + pwcChannelTitle + '.powerValue', {val: 0, ack: true});
			await this.setStateAsync(this.namespace + '.loadPowerControl.channels.' + pwcChannelTitle + '.powerOn', {val: false, ack: true});
			await this.setStateAsync(this.namespace + '.loadPowerControl.channels.' + pwcChannelTitle + '.shutdownDelay', {val: 0, ack: true});
			await this.setStateAsync(this.namespace + '.loadPowerControl.channels.' + pwcChannelTitle + '.activationDelay', {val: activationDelay, ack: true});
			return true;
		}
	}

	async getPwcActivePowerConsumptionValue(pwcChannelTitle) {
		try {
			const activePowerConsumption = await this.getForeignStateAsync(this.namespace + '.loadPowerControl.channels.' + pwcChannelTitle + '.powerValue');
			if (activePowerConsumption && activePowerConsumption.val != null) {
				return parseFloat(activePowerConsumption.val.toString());
			} else {
				return 0;
			}
		} catch (error) {
			this.log.error(error);
			return 0;
		}
	}

	async getPwcShutDownDelay(pwcChannelTitle) {
		try {
			const shutdownDelay = await this.getForeignStateAsync(this.namespace + '.loadPowerControl.channels.' + pwcChannelTitle + '.shutdownDelay');
			if (shutdownDelay && shutdownDelay.val != null) {
				return parseFloat(shutdownDelay.val.toString());
			} else {
				return 0;
			}
		} catch (error) {
			this.log.error(error);
			return 0;
		}
	}

	async getPwcConfigShutDownDelay(pwcChannelTitle) {
		let cfgTable = this.config.powerControlChannels;
		let cfgShutdownDelay = -1;
		if (cfgTable && Array.isArray(cfgTable)) {
			for (let p in cfgTable) {
				let cfgTableEntry = cfgTable[p];
				if (cfgTableEntry.pwcChannelTitle == pwcChannelTitle) {
					cfgShutdownDelay = parseInt(cfgTableEntry.pwcChannelShutdownDelay);
				}
			}
		}
		return cfgShutdownDelay;
	}

	async getPwcActivationDelay(pwcChannelTitle) {
		try {
			const activationDelay = await this.getForeignStateAsync(this.namespace + '.loadPowerControl.channels.' + pwcChannelTitle + '.activationDelay');
			if (activationDelay && activationDelay.val != null) {
				return parseFloat(activationDelay.val.toString());
			} else {
				return 0;
			}
		} catch (error) {
			this.log.error(error);
			return 0;
		}
	}

	async getPwcConfigActivationDelay(pwcChannelTitle) {
		let cfgTable = this.config.powerControlChannels;
		let cfgActivationDelay = -1;
		if (cfgTable && Array.isArray(cfgTable)) {
			for (let p in cfgTable) {
				let cfgTableEntry = cfgTable[p];
				if (cfgTableEntry.pwcChannelTitle == pwcChannelTitle) {
					cfgActivationDelay = parseInt(cfgTableEntry.pwcChannelActivationDelay);
				}
			}
		}
		return cfgActivationDelay;
	}

	async getPwcSumActiveLoad() {
		try {
			const sumActiveLoad = await this.getForeignStateAsync(this.namespace + '.loadPowerControl.sumActiveLoad');
			if (sumActiveLoad && sumActiveLoad.val != null) {
				return parseFloat(sumActiveLoad.val.toString());
			} else {
				return 0;
			}
		} catch (error) {
			this.log.error(error);
			return 0;
		}
	}

	async calcPowerBudget(pFloatExport, pFloatImport, pFloatBatDischarge) {
		const exportThreshold = parseFloat(this.config.exportThreshold)/1000;
		const importThreshold = parseFloat(this.config.importThreshold)/1000;
		if ((pFloatBatDischarge > 0) && (pFloatImport > importThreshold)) {
			return (pFloatBatDischarge + pFloatImport)*-1;
		}
		if ((pFloatBatDischarge > 0) && (pFloatExport > exportThreshold)) {
			return pFloatExport - pFloatBatDischarge;
		}
		if (pFloatBatDischarge > 0) {
			return pFloatBatDischarge*-1;
		}
		if (pFloatImport > importThreshold) {
			return pFloatImport*-1;
		}
		if (pFloatExport > exportThreshold) {
			return pFloatExport;
		}
		return 0;
	}

	async resetShutdownDelays(cfgTable) {
		if (cfgTable && Array.isArray(cfgTable)) {
			for (let p in cfgTable) {
				let cfgTableEntry = cfgTable[p];
				if (cfgTableEntry.pwcChannelEnabled) {
					await this.setStateAsync(this.namespace + '.loadPowerControl.channels.' + cfgTableEntry.pwcChannelTitle + '.shutdownDelay', {val: parseInt(cfgTableEntry.pwcChannelShutdownDelay), ack: true});
				}
			}

		}
	}

	async resetActivationDelays(cfgTable) {
		if (cfgTable && Array.isArray(cfgTable)) {
			for (let p in cfgTable) {
				let cfgTableEntry = cfgTable[p];
				if (cfgTableEntry.pwcChannelEnabled) {
					await this.setStateAsync(this.namespace + '.loadPowerControl.channels.' + cfgTableEntry.pwcChannelTitle + '.activationDelay', {val: parseFloat(cfgTableEntry.pwcChannelActivationDelay), ack: true});
				}
			}

		}
	}

	async initEnergyStorageChannels() {
		this.log.info('EnergyStorageInitChannels started');
		let cfgTable = this.config.energyStorageControlChannels;
		let counter = 0;
		await this.setStateAsync(this.namespace + '.energyStorageControl.sumActiveChargePower', {val: 0, ack: true});
		await this.setStateAsync(this.namespace + '.energyStorageControl.sumActiveDischargePower', {val: 0, ack: true});
		if (this.supportsFeature && this.supportsFeature('ADAPTER_DEL_OBJECT_RECURSIVE')) {
			await this.delObjectAsync(this.namespace + '.energyStorageControl.channels', { recursive: true });
		}
		if (cfgTable && Array.isArray(cfgTable)) {
			this.log.info('EnergyStorageInitChannels started');
			for (let p in cfgTable) {
				let cfgTableEntry = cfgTable[p];
				//ToDo: Fehlermeldung für leeren Title einbauen
				if (cfgTableEntry.esChannelTitle) {
					this.log.info('EnergyStorageInitChannel: ' + cfgTableEntry.esChannelTitle);
					counter +=1;
					await this.createObjectTreeESC(cfgTableEntry,counter);
					//let channelPrefix = this.leadingZero(counter,3);
					//let socObjId = cfgTableEntry.socObjectId;
					//let pwrFactor = parseFloat(cfgTableEntry.pwrFactor);
				}
			}
		}
		//this.log.debug('BatSoCSum: ' + socValue/counter + ' %');
	}

	async createObjectTreeESC(cfgTableEntry,priority) {
		/*
		await this.setObjectNotExistsAsync(this.namespace + '.loadPowerControl.' + cfgTableEntry.pwcChannelTitle , {
			type: 'state',
			common: {
				name: 'testVariable',
				type: 'boolean',
				role: 'indicator',
				read: true,
				write: true,
			},
			native: {},
		});*/
		await this.setObjectNotExistsAsync(this.namespace + '.energyStorageControl.channels', {
			type: 'folder',
			common: {
				name: 'Energy Storage Control Channels'
			},
			native: {},
		});
		await this.setObjectNotExistsAsync(this.namespace + '.energyStorageControl.channels.' + cfgTableEntry.esChannelTitle , {
			type: 'folder',
			common: {
				name: cfgTableEntry.esChannelDescription
			},
			native: {},
		});
		await this.setObjectNotExistsAsync(this.namespace + '.energyStorageControl.channels.' + cfgTableEntry.esChannelTitle + '.priority' , {
			type: 'state',
			common: {
				name: 'Priority',
				type: 'number',
				role: 'value',
				read: true,
				write: true,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync(this.namespace + '.energyStorageControl.channels.' + cfgTableEntry.esChannelTitle + '.active' , {
			type: 'state',
			common: {
				name: 'Active',
				type: 'boolean',
				role: 'indicator',
				read: true,
				write: true,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync(this.namespace + '.energyStorageControl.channels.' + cfgTableEntry.esChannelTitle + '.chargeOn' , {
			type: 'state',
			common: {
				name: 'ChargeOn',
				type: 'boolean',
				role: 'switch.power',
				read: true,
				write: true,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync(this.namespace + '.energyStorageControl.channels.' + cfgTableEntry.esChannelTitle + '.chargePowerValue' , {
			type: 'state',
			common: {
				name: 'ChargePowerValue',
				type: 'number',
				role: 'value',
				unit: 'kW',
				read: true,
				write: true,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync(this.namespace + '.energyStorageControl.channels.' + cfgTableEntry.esChannelTitle + '.dischargeOn' , {
			type: 'state',
			common: {
				name: 'DischargeOn',
				type: 'boolean',
				role: 'switch.power',
				read: true,
				write: true,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync(this.namespace + '.energyStorageControl.channels.' + cfgTableEntry.esChannelTitle + '.dischargePowerValue' , {
			type: 'state',
			common: {
				name: 'DischargePowerValue',
				type: 'number',
				role: 'value',
				unit: 'kW',
				read: true,
				write: true,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync(this.namespace + '.energyStorageControl.channels.' + cfgTableEntry.esChannelTitle + '.shutdownDelay' , {
			type: 'state',
			common: {
				name: 'ShutdownDelay',
				type: 'number',
				role: 'value',
				unit: 's',
				read: true,
				write: true,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync(this.namespace + '.energyStorageControl.channels.' + cfgTableEntry.esChannelTitle + '.activationDelay' , {
			type: 'state',
			common: {
				name: 'ActivationDelay',
				type: 'number',
				role: 'value',
				read: true,
				write: true,
			},
			native: {},
		});
		await this.setStateAsync(this.namespace + '.energyStorageControl.channels.' + cfgTableEntry.esChannelTitle + '.priority', {val: priority, ack: true});
		await this.setStateAsync(this.namespace + '.energyStorageControl.channels.' + cfgTableEntry.esChannelTitle + '.active', {val: cfgTableEntry.esChannelEnabled, ack: true});
		await this.setStateAsync(this.namespace + '.energyStorageControl.channels.' + cfgTableEntry.esChannelTitle + '.chargeOn', {val: false, ack: true});
		await this.setStateAsync(this.namespace + '.energyStorageControl.channels.' + cfgTableEntry.esChannelTitle + '.chargePowerValue', {val: 0, ack: true});
		await this.setStateAsync(this.namespace + '.energyStorageControl.channels.' + cfgTableEntry.esChannelTitle + '.dischargeOn', {val: false, ack: true});
		await this.setStateAsync(this.namespace + '.energyStorageControl.channels.' + cfgTableEntry.esChannelTitle + '.dischargePowerValue', {val: 0, ack: true});
		await this.setStateAsync(this.namespace + '.energyStorageControl.channels.' + cfgTableEntry.esChannelTitle + '.shutdownDelay', {val: parseFloat(cfgTableEntry.esChannelShutdownDelay), ack: true});
		await this.setStateAsync(this.namespace + '.energyStorageControl.channels.' + cfgTableEntry.esChannelTitle + '.activationDelay', {val: parseFloat(cfgTableEntry.esChannelActivationDelay), ack: true});
	}

	async energyStorageControl(pPowerValues) {
		if (this.config.powerControlActive) {
			let powerBudget = await pPowerValues.calcPowerBudget();
			//this.log.info('Powerbudget: '+powerBudget);
			//let cfgTable = this.config.powerControlChannels;
			let cfgTable = this.config.energyStorageControlChannels;
			let sumPowerConsumption = 0;
			let dynamicLoadDecreaseActive = false;
			//Check if Powercontrolchannels exists in the setup
			if (cfgTable && Array.isArray(cfgTable)) {
				//powerBudget > 0, activate charging in EnergyStorageChannels to store the energy
				if (powerBudget > 0) {
					for (let p in cfgTable) {
						let cfgTableEntry = cfgTable[p];
						if (cfgTableEntry.esChannelEnabled) {
							let maxPower = cfgTableEntry.pwcChannelMaxPower;
							let minPower = cfgTableEntry.pwcChannelMinPower;
							let powerStepSize = cfgTableEntry.pwcChannelStepSize;
							let shutdownDelay = cfgTableEntry.pwcChannelShutdownDelay;
							let activePowerConsumptionValue = await this.getPwcActivePowerConsumptionValue(cfgTableEntry.pwcChannelTitle);
							//current channel active power consumption = 0
							if (activePowerConsumptionValue == 0) {
								// static channel
								if ((maxPower == minPower) && (powerStepSize == 0)) {
									if (minPower <= powerBudget) {
										//activate powerChannel
										if (await this.activatePwcChannel(cfgTableEntry.pwcChannelTitle,minPower,shutdownDelay)) {
											powerBudget -= minPower;
											sumPowerConsumption += minPower;
										}
									}
								// dynamic channel
								} else if ((maxPower > minPower) && (powerStepSize > 0)) {
									if (minPower <= powerBudget) {
										let powerTarget = minPower;
										while (powerTarget + powerStepSize <= powerBudget) {
											powerTarget += powerStepSize;
										}
										if (await this.activatePwcChannel(cfgTableEntry.pwcChannelTitle,powerTarget,shutdownDelay)) {
											powerBudget -= powerTarget;
											sumPowerConsumption += powerTarget;
										}
									}
								}
							// powerChannel already active, check if it is a dynamic channel
							} else if ((maxPower > minPower) && (powerStepSize > 0)) {
								if (powerStepSize <= powerBudget) {
									// increase powerconsumption of dynamic channel
									let newPowerConsumption = await this.increasePowerPwcChannel(cfgTableEntry.pwcChannelTitle,powerStepSize,maxPower,shutdownDelay,powerBudget);
									powerBudget -= newPowerConsumption;
									sumPowerConsumption += newPowerConsumption;
								} else {
									sumPowerConsumption += activePowerConsumptionValue;
								}
							} else {
								sumPowerConsumption += activePowerConsumptionValue;
							}
						}
					}
					// set current sum of powerconsumption of all channels
					await this.setStateAsync(this.namespace + '.loadPowerControl.sumActiveLoad', {val: sumPowerConsumption, ack: true});
				}
				// decrease or deactivate the powerconsumption of dynamic or static powerChannels
				else if (powerBudget < 0) {
					let tabelCounter = cfgTable.length;
					for (let i = tabelCounter - 1; i >= 0; i--) {
						let cfgTableEntry = cfgTable[i];
						if (cfgTableEntry.pwcChannelEnabled) {
							let maxPower = cfgTableEntry.pwcChannelMaxPower;
							let minPower = cfgTableEntry.pwcChannelMinPower;
							let powerStepSize = cfgTableEntry.pwcChannelStepSize;
							//let shutdownDelay = cfgTableEntry.pwcChannelShutdownDelay;
							let activationDelay = cfgTableEntry.pwcChannelActivationDelay;
							let activePowerConsumptionValue = await this.getPwcActivePowerConsumptionValue(cfgTableEntry.pwcChannelTitle);
							if (activePowerConsumptionValue > 0) {
								if ((maxPower == minPower) && (powerStepSize == 0)) {
									if (dynamicLoadDecreaseActive == false) {
										if (await this.deactivatePwcChannel(cfgTableEntry.pwcChannelTitle,activationDelay)) {
											powerBudget += activePowerConsumptionValue;
										} else {
											sumPowerConsumption += activePowerConsumptionValue;
										}
									} else {
										sumPowerConsumption += activePowerConsumptionValue;
									}
								} else if ((maxPower > minPower) && (powerStepSize > 0)) {
									dynamicLoadDecreaseActive = true;
									if (activePowerConsumptionValue > minPower) {
										let newPowerConsumption = await this.decreasePowerPwcChannel(cfgTableEntry.pwcChannelTitle,powerStepSize,minPower,powerBudget);
										powerBudget += newPowerConsumption;
										sumPowerConsumption += newPowerConsumption;
									} else {
										if (await this.deactivatePwcChannel(cfgTableEntry.pwcChannelTitle,activationDelay)) {
											powerBudget += activePowerConsumptionValue;
										} else {
											sumPowerConsumption += activePowerConsumptionValue;
										}
									}
								}

							}

						}
					}
					await this.setStateAsync(this.namespace + '.loadPowerControl.sumActiveLoad', {val: sumPowerConsumption, ack: true});
				} else {
					await this.resetShutdownDelays(cfgTable);
					await this.resetActivationDelays(cfgTable);
				}
			}
		}
	}


	/**
	 * Neue Speichersteuerung: verteilt Netzeinspeisung/-bezug gewichtet nach SoC
	 * auf alle EFM-gesteuerten Speicherkanäle (Wasserfall-Verteilung mit
	 * Rampenbegrenzung). Läuft parallel zur bestehenden energyStorageControl().
	 * @param {PowerValues} pPowerValues
	 */
	async energyStorageControlWaterfall(pPowerValues) {
		if (!this.config.energyStorageControlActive) {
			return;
		}
		const cfgTable = this.config.energyStorageControlChannels;
		if (!cfgTable || !Array.isArray(cfgTable)) {
			return;
		}

		const exportThresholdKW = parseNumOr(this.config.exportThreshold, 50) / 1000;
		const importThresholdKW = parseNumOr(this.config.importThreshold, 50) / 1000;
		const rampeKwProS = parseNumOr(this.config.energyStorageRampRate, 0.5);
		const minGewicht = parseNumOr(this.config.energyStorageMinWeight, 0.01);
		const dtSekunden = parseInt(this.config.updateInterval) || 2;

		const speicherListe = [];
		for (const cfgTableEntry of cfgTable) {
			if (!isEsChannelEfmControlled(cfgTableEntry) || !cfgTableEntry.esChannelTitle) {
				continue;
			}
			const soc = await this.getEsSoCValue(cfgTableEntry.esSoC);
			if (soc == null) {
				this.log.warn('energyStorageControlWaterfall: Kein SoC-Wert für Kanal ' + cfgTableEntry.esChannelTitle + ', Kanal wird übersprungen.');
				continue;
			}
			const chargePowerValue = await this.getEsChannelMeasuredPower(cfgTableEntry.esChargePower, cfgTableEntry.esChgPwrFactor);
			const dischargePowerValue = await this.getEsChannelMeasuredPower(cfgTableEntry.esDischargePower, cfgTableEntry.esDischgPwrFactor);
			speicherListe.push({
				id: cfgTableEntry.esChannelTitle,
				soc: soc,
				minSoc: parseNumOr(cfgTableEntry.esSoCMin, 0),
				maxSoc: parseNumOr(cfgTableEntry.esSoCMax, 100),
				maxLadeleistung: parseNumOr(cfgTableEntry.esMaxChargePower, 0),
				minLadeleistung: parseNumOr(cfgTableEntry.esMinChargePower, 0),
				maxEntladeleistung: parseNumOr(cfgTableEntry.esMaxDischargePower, 0),
				minEntladeleistung: parseNumOr(cfgTableEntry.esMinDischargePower, 0),
				capacityKWh: parseNumOr(cfgTableEntry.esCapacity, 0),
				aktuelleLeistung: chargePowerValue - dischargePowerValue
			});
		}

		if (speicherListe.length === 0) {
			return;
		}

		// Speicher außerhalb der Speichersteuerung regeln über ihre eigene Logik
		// bereits selbst auf Netzbezug/-einspeisung = 0. Es genügt daher, das
		// Lade-/Entladebudget der EFM-Speicher um deren aktuelle Gegenleistung zu
		// kürzen, damit die EFM-Speicher weder Energie aus den Fremdspeichern
		// ziehen noch diese über den Umweg laden.
		const notEfmControlled = cfgTableEntry => !isEsChannelEfmControlled(cfgTableEntry);
		const fremdLadeleistung = await this.getSumChgPwrFromEsCfgTable(cfgTable, notEfmControlled);
		const fremdEntladeleistung = await this.getSumDischgPwrFromEsCfgTable(cfgTable, notEfmControlled);

		this.log.debug('energyStorageControlWaterfall: gridExport=' + pPowerValues.exportPwrValue + 'kW, gridImport=' + pPowerValues.importPwrValue
			+ 'kW, fremdLadeleistung=' + fremdLadeleistung + 'kW, fremdEntladeleistung=' + fremdEntladeleistung + 'kW');
		for (const s of speicherListe) {
			this.log.debug('energyStorageControlWaterfall: Speicher ' + s.id + ': soc=' + s.soc + '%, minSoc=' + s.minSoc + '%, maxSoc=' + s.maxSoc
				+ '%, capacity=' + s.capacityKWh + 'kWh, aktuelleLeistung=' + s.aktuelleLeistung + 'kW, ladeGewicht=' + ladeGewicht(s, minGewicht)
				+ ', entladeGewicht=' + entladeGewicht(s, minGewicht));
		}

		const ergebnis = regelzyklusSchritt(
			pPowerValues.exportPwrValue,
			pPowerValues.importPwrValue,
			speicherListe,
			dtSekunden,
			exportThresholdKW,
			importThresholdKW,
			rampeKwProS,
			minGewicht,
			fremdLadeleistung,
			fremdEntladeleistung
		);

		this.log.debug('energyStorageControlWaterfall: Ergebnis: ' + JSON.stringify(ergebnis.speicher)
			+ ', restEinspeisung=' + ergebnis.einspeisung + 'kW, restBezug=' + ergebnis.bezug + 'kW');

		let sumCharge = 0;
		let sumDischarge = 0;
		for (const eintrag of ergebnis.speicher) {
			const leistung = eintrag.leistung;
			const chargeOn = leistung > 1e-6;
			const dischargeOn = leistung < -1e-6;
			await this.setStateAsync(this.namespace + '.energyStorageControl.channels.' + eintrag.id + '.chargeOn', {val: chargeOn, ack: true});
			await this.setStateAsync(this.namespace + '.energyStorageControl.channels.' + eintrag.id + '.chargePowerValue', {val: chargeOn ? leistung : 0, ack: true});
			await this.setStateAsync(this.namespace + '.energyStorageControl.channels.' + eintrag.id + '.dischargeOn', {val: dischargeOn, ack: true});
			await this.setStateAsync(this.namespace + '.energyStorageControl.channels.' + eintrag.id + '.dischargePowerValue', {val: dischargeOn ? -leistung : 0, ack: true});
			if (chargeOn) {
				sumCharge += leistung;
			}
			if (dischargeOn) {
				sumDischarge += -leistung;
			}
		}
		await this.setStateAsync(this.namespace + '.energyStorageControl.sumActiveChargePower', {val: sumCharge, ack: true});
		await this.setStateAsync(this.namespace + '.energyStorageControl.sumActiveDischargePower', {val: sumDischarge, ack: true});
	}

	async getEsSoCValue(socObjId) {
		if (!socObjId) {
			return null;
		}
		try {
			const socState = await this.getForeignStateAsync(socObjId);
			if (socState && socState.val != null) {
				return parseFloat(socState.val.toString());
			}
		} catch (error) {
			this.log.error(error);
		}
		return null;
	}

	/**
	 * Liest die tatsächlich gemessene Lade-/Entladeleistung eines Speicherkanals
	 * (Objekt aus esChargePower/esDischargePower), statt sich auf den zuletzt von
	 * der Adapter-Logik gesetzten Sollwert zu verlassen, da reale Speicher
	 * Steuerbefehle träge und nicht sofort vollständig umsetzen.
	 */
	async getEsChannelMeasuredPower(pwrObjId, pwrFactor) {
		if (!pwrObjId) {
			return 0;
		}
		try {
			const powerState = await this.getForeignStateAsync(pwrObjId);
			if (powerState && powerState.val != null && Number.isFinite(powerState.val)) {
				const value = parseFloat(powerState.val.toString()) * parseNumOr(pwrFactor, 1);
				return value > 0 ? value : 0;
			}
		} catch (error) {
			this.log.error(error);
		}
		return 0;
	}

	/**
	 * Prüft, ob alle EFM-kontrollierten Energiespeicher entweder voll geladen
	 * (SoC >= esSoCMax) oder bereits an ihrer maximalen Ladeleistung
	 * (esMaxChargePower) angekommen sind. Nur dann dürfen LoadPowerControl-
	 * Kanäle einen PV-Überschuss für sich beanspruchen - solange ein Speicher
	 * noch Kapazität hat und nicht mit voller Leistung lädt, hat das Laden
	 * Vorrang.
	 */
	async areEnergyStoragesSaturated() {
		if (!this.config.energyStorageControlActive) {
			return true;
		}
		const cfgTable = this.config.energyStorageControlChannels;
		if (!cfgTable || !Array.isArray(cfgTable)) {
			return true;
		}
		const toleranzKW = 0.001;
		for (const cfgTableEntry of cfgTable) {
			if (!isEsChannelEfmControlled(cfgTableEntry) || !cfgTableEntry.esChannelTitle) {
				continue;
			}
			const soc = await this.getEsSoCValue(cfgTableEntry.esSoC);
			if (soc == null) {
				continue;
			}
			const maxSoc = parseNumOr(cfgTableEntry.esSoCMax, 100);
			if (soc >= maxSoc) {
				continue;
			}
			const maxChargePower = parseNumOr(cfgTableEntry.esMaxChargePower, 0);
			const chargePower = await this.getEsChannelMeasuredPower(cfgTableEntry.esChargePower, cfgTableEntry.esChgPwrFactor);
			if (chargePower + toleranzKW >= maxChargePower) {
				continue;
			}
			return false;
		}
		return true;
	}

	leadingZero(num, size) {
		num = num.toString();
		while (num.length < size) num = '0' + num;
		return num;
	}



	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			// Here you must clear all timeouts or intervals that may still be active
			// clearTimeout(timeout1);
			// clearTimeout(timeout2);
			// ...
			this.log.info('cleaned everything up...');
			this.clearInterval(this.intervalId);

			callback();
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		} catch (e) {
			callback();
		}
	}

	// If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
	// You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
	// /**
	//  * Is called if a subscribed object changes
	//  * @param {string} id
	//  * @param {ioBroker.Object | null | undefined} obj
	//  */
	// onObjectChange(id, obj) {
	// 	if (obj) {
	// 		// The object was changed
	// 		this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
	// 	} else {
	// 		// The object was deleted
	// 		this.log.info(`object ${id} deleted`);
	// 	}
	// }

	/**
	 * Is called if a subscribed state changes
	 * @param {string} id
	 * @param {ioBroker.State | null | undefined} state
	/**
	onStateChange(id, state) {
		if (state) {
			// The state was changed
			this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
		} else {
			// The state was deleted
			this.log.info(`state ${id} deleted`);
		}
	}
 	*/
	// If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
	// /**
	//  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
	//  * Using this method requires "common.messagebox" property to be set to true in io-package.json
	//  * @param {ioBroker.Message} obj
	//  */
	// onMessage(obj) {
	// 	if (typeof obj === 'object' && obj.message) {
	// 		if (obj.command === 'send') {
	// 			// e.g. send email or pushover or whatever
	// 			this.log.info('send command');

	// 			// Send response in callback if required
	// 			if (obj.callback) this.sendTo(obj.from, obj.command, 'Message received', obj.callback);
	// 		}
	// 	}
	// }

}

if (require.main !== module) {
	// Export the constructor in compact mode
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	module.exports = (options) => new EnergyFlowMotion(options);
} else {
	// otherwise start the instance directly
	new EnergyFlowMotion();
}
