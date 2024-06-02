'use strict';

/*
 * Created with @iobroker/create-adapter v2.5.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');

// Load your modules here, e.g.:
// const fs = require("fs");

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
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		await this.initPowerControlChannels();
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
		let pvPwrValue = 0, loadPwrValur = 0, exportPwrValue = 0, importPwrValue = 0, batChargePwrValue = 0, batDischargePwrValue = 0, batSoCValue = 0;
		pvPwrValue = await this.getPvPowerSumValue();
		loadPwrValur = await this.getLoadPowerSumValue();
		exportPwrValue = await this.getGridExportPowerSumValue();
		importPwrValue = await this.getGridImportPowerSumValue();
		batChargePwrValue = await this.getBatteryChargePowerSumValue();
		batDischargePwrValue = await this.getBatteryDischargePowerSumValue();
		batSoCValue = await this.getBatterySoCSumValue();

		if ((exportPwrValue > 0) && (importPwrValue >0)) {
			if (exportPwrValue >= importPwrValue) {
				importPwrValue = 0;
			} 
			else {
				exportPwrValue = 0;
			}
		}

		if ((batChargePwrValue > 0) && (batDischargePwrValue > 0)) {
			if (batChargePwrValue >= batDischargePwrValue) {
				batDischargePwrValue = 0;
			}
			else {
				batChargePwrValue = 0;
			}
		}

		//this.log.info('Namespace: ' + this.namespace);
		await this.setStateAsync(this.namespace + '.power.pvpower', {val: pvPwrValue, ack: true});
		await this.setStateAsync(this.namespace + '.power.load', {val: loadPwrValur, ack: true});
		await this.setStateAsync(this.namespace + '.power.export', {val: exportPwrValue, ack: true});
		await this.setStateAsync(this.namespace + '.power.import', {val: importPwrValue, ack: true});
		await this.setStateAsync(this.namespace + '.power.batteryCharge', {val: batChargePwrValue, ack: true});
		await this.setStateAsync(this.namespace + '.power.batteryDischarge', {val: batDischargePwrValue, ack: true});
		await this.setStateAsync(this.namespace + '.power.batterySoC', {val: batSoCValue, ack: true});
		await this.efmCalcEnergyHistory(pvPwrValue,loadPwrValur,exportPwrValue,importPwrValue,batChargePwrValue,batDischargePwrValue);
		await this.loadPowerControl(pvPwrValue,loadPwrValur,exportPwrValue,importPwrValue,batChargePwrValue,batDischargePwrValue);
	}

	async getPvPowerSumValue(){
		let pwrValue = await this.getSumValuesFromCfgTables(this.config.pvPowerDataTable);
		this.log.debug('PvPowerSum: ' + pwrValue + ' kW');
		return pwrValue;
	}

	async getLoadPowerSumValue(){
		let pwrValue = await this.getSumValuesFromCfgTables(this.config.loadDataTable);
		this.log.debug('LoadPowerSum: ' + pwrValue + ' kW');
		return pwrValue;
	}

	async getGridImportPowerSumValue(){
		let pwrValue = await this.getSumValuesFromCfgTables(this.config.importDataTable);
		this.log.debug('ImportPowerSum: ' + pwrValue + ' kW');
		return pwrValue;
	}

	async getGridExportPowerSumValue(){
		let pwrValue = await this.getSumValuesFromCfgTables(this.config.exportDataTable);
		this.log.debug('ExportPowerSum: ' + pwrValue + ' kW');
		return pwrValue;
	}

	async getBatteryChargePowerSumValue(){
		let pwrValue = await this.getSumValuesFromCfgTables(this.config.batChargeDataTable);
		this.log.debug('BatChargePowerSum: ' + pwrValue + ' kW');
		return pwrValue;
	}

	async getBatteryDischargePowerSumValue(){
		let pwrValue = await this.getSumValuesFromCfgTables(this.config.batDischargeDataTable);
		this.log.debug('BatDischargePowerSum: ' + pwrValue + ' kW');
		return pwrValue;
	}

	async getBatterySoCSumValue(){
		let cfgTable = this.config.batSoCDataTable;
		let socValue = 0;
		let counter = 0;
		if (cfgTable && Array.isArray(cfgTable)) {
			for (const p in cfgTable) {
				const cfgTableEntry = cfgTable[p];
				if (cfgTableEntry.socObjectId) {
					let socObjId = cfgTableEntry.socObjectId;
					try {
						let socState = await this.getForeignStateAsync(socObjId);
						if (socState.val != null) {							
							socValue += parseFloat(socState.val);
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
			for (const p in cfgTable) {
				const cfgTableEntry = cfgTable[p];
				//this.log.info('Entry Selected');
				if (cfgTableEntry.pwrObjectId) {
					let pwrObjId = cfgTableEntry.pwrObjectId;
					let pwrFactor = parseFloat(cfgTableEntry.pwrFactor);
					//this.log.info('Entry Read');
					try {
						let powerState = await this.getForeignStateAsync(pwrObjId);
						if (powerState.val != null) {
							if (isNaN(powerState.val)){
								pwrValue = 0;
							} else {
								if ((parseFloat(powerState.val)*pwrFactor) < 0) {
									this.log.debug('Value for ' + cfgTableEntry.pwrObjectId + ' is negative (Calculated Value is: ' + parseFloat(powerState.val)*pwrFactor +') setting Value to zero.');								
								} 
								pwrValue += parseFloat(powerState.val)*pwrFactor;														
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
			return 0
		} 
		else {
			return pwrValue;
		}		
	}

	async getEnergyCounterTimePeriod() {
		var sEfmPathTimePeriod = ["day"];
		if (this.config.energyCounterMonthActive) {
			sEfmPathTimePeriod.push("month");
		}
		if (this.config.energyCounterYearActive) {
			sEfmPathTimePeriod.push("year");
		}
		return sEfmPathTimePeriod;		
	}

	async getValueIDs() {
		const sEfmValueIDs = new Array("date","load","pv","export","import","selfConsumption","batteryDischarge","batteryCharge","selfConsumptionQuota","autarchyQuota");
		return sEfmValueIDs;
	}

	async getEnergyPathLive() {
		var sPathEnergyValues = this.namespace + '.energy.live';
		return sPathEnergyValues;
	}

	async getEnergyPathHistory() {
		var sPathEnergyValues = this.namespace + '.energy.history';
		return sPathEnergyValues;
	}

	async efmCalcEnergyHistory (pFloatPvPower, pFloatLoad, pFloatExport, pFloatImport, pFloatBatCharge, pFloatBatDischarge)  {				
		// aktuelle Energiezählerstände einlesen
		var vEfmValues = await this.readValues();
		// Zählerstandhistorie managen (Tageswechsel etc. historische Zählerstände neu schreiben)
		vEfmValues = await this.historyManage(vEfmValues);
		// aktuelle Zählerstände berechnen
		var vEfmCalcValues = await this.calcValues(pFloatPvPower, pFloatLoad, pFloatExport, pFloatImport, pFloatBatCharge, pFloatBatDischarge,vEfmValues);
		// Zählerstände in States schreiben
		await this.writeValues(vEfmCalcValues);
	}

	async readValues() {
		const pEfmPathTimePeriod = await this.getEnergyCounterTimePeriod();
		const sPathEnergyValues = await this.getEnergyPathLive();	
		let iPathArrayLen = pEfmPathTimePeriod.length;
		var vEfmValues = [[],[],[]];
		var sEfmCurrPath = '';
		const sEfmValueIDs = await this.getValueIDs();
		let iValueIDsArrayLen = sEfmValueIDs.length;
		// Alle aktuellen Werte abrufen
		for (var x = 0; x < iPathArrayLen; x++) {
			sEfmCurrPath = sPathEnergyValues + '.' + pEfmPathTimePeriod[x] + '.';
			this.log.debug('Path for loading Values:' + sEfmCurrPath);
			for (var y = 0; y < iValueIDsArrayLen; y++) {        
				this.log.debug('Path for Value:' + sEfmCurrPath + sEfmValueIDs[y]);
				try {
					let stateObject = await this.getStateAsync(sEfmCurrPath + sEfmValueIDs[y]);
					if (stateObject.val != null) {
						if (sEfmValueIDs[y] == 'date') {
							vEfmValues[x][y] = new Date (stateObject.val);
						} else {
							vEfmValues[x][y] = stateObject.val;
						};											
						//this.log.info('Object: ' + pwrObjId + ' , PowerFactor:' + pwrFactor + ', PowerRead:' + pwrValue);
					}						
				} catch (error) {
					this.log.error(error);
				}				
				//if (stateObject) {

				//if (vEfmValues[x][y] == 0) { !! An dieser Stelle nur die kWh Load und Import Werte abfragen
				//  log('Read value is 0 :' + sEfmCurrPath + sEfmValueIDs[y], 'warn');  
				//}
				//} else {
				//  vEfmValues[x][y] = 0;
				//  log('Unable to get state value of ' + sEfmCurrPath + sEfmValueIDs[y] + '. ' + JSON.stringify(stateObject), 'warn');
				//};
			};
		};
		return vEfmValues;
	}

	async historyManage(pEfmValues) {		
		const pEfmPathTimePeriod = await this.getEnergyCounterTimePeriod();		
		let iPathArrayLen = pEfmPathTimePeriod.length;
		const sEfmValueIDs = await this.getValueIDs();
		const sEnergyPathHistory = await this.getEnergyPathHistory();
		let iValueIDsArrayLen = sEfmValueIDs.length;
		var sEfmCurrPath = '';
		var newDate;
		var vCalcDate = [];
		var now = [];	
		newDate = new Date();
		newDate.setHours(0,0,30,0);
		// Aktuelle Werte für den Datumsvergleich setzen	
		for (var xa = 0; xa < iPathArrayLen; xa++) {
			now[xa] = new Date();
			//now[xa].setHours(0,0,30,0);
		}			
		for (var xb = 0; xb < iPathArrayLen; xb++) {
			vCalcDate[xb] = new Date (pEfmValues[xb][0].valueOf());
			//vCalcDate[xb] = new Date (JSON.parse(pEfmValues[xb][0]));
		}
		vCalcDate[0].setDate(vCalcDate[0].getDate() + 1);
		if (this.config.energyCounterMonthActive) {			
			now[1].setDate(1);
			vCalcDate[1].setDate(1);
			vCalcDate[1].setMonth(vCalcDate[1].getMonth() + 1);			
		}
		if (this.config.energyCounterYearActive) {
			now[2].setDate(1);
			now[2].setMonth(0);
			vCalcDate[2].setDate(1);
			vCalcDate[2].setMonth(0);
			vCalcDate[2].setFullYear(vCalcDate[2].getFullYear() + 1);			
		}	

		/*
		log('Value of now: ' + now.toString(),'info');
		log('Value of vCalcDate: ' + vCalcDate.toString(),'info');
		log('Value of nowMonth: ' + nowMonth.toString(),'info');
		log('Value of vCalcMonth: ' + vCalcMonth.toString(),'info');
		log('Value of nowYear: ' + nowYear.toString(),'info');
		log('Value of vCalcYear: ' + vCalcYear.toString(),'info');
		*/

		// Reset Counters and write History
		for (var xc = 0; xc < iPathArrayLen; xc++) {
			sEfmCurrPath = sEnergyPathHistory + '.' + pEfmPathTimePeriod[xc] + '.';
			if (now[xc].valueOf() >= vCalcDate[xc].valueOf()) {
				this.log.debug('now[' + xc.toString() + '] and vCalcDate[' + xc.toString() + ']: ' + now[xc].toString() + ' and ' + vCalcDate[xc].toString());
				for (var yc = 0; yc < iValueIDsArrayLen; yc++) {            
					if (sEfmValueIDs[yc] == 'date') {
						this.log.debug('sEfmCurrPath: ' + sEfmCurrPath + sEfmValueIDs[yc] + ' sEfmValueIDs[' + yc.toString() +']:' + sEfmValueIDs[yc] + 'Value: ' + pEfmValues[xc][yc].valueOf());
						try {
							//await this.setStateAsync(sEfmCurrPath + sEfmValueIDs[yc],JSON.stringify(pEfmValues[xc][yc]),true);
							await this.setStateAsync(sEfmCurrPath + sEfmValueIDs[yc],pEfmValues[xc][yc].valueOf(),true);
						} 
						catch(error) {
							this.log.error(error);
						}						
						
					} else {
						this.log.debug('sEfmCurrPath: ' + sEfmCurrPath + sEfmValueIDs[yc] + ' sEfmValueIDs[' + yc.toString() +']:' + sEfmValueIDs[yc] + 'Value: ' + pEfmValues[xc][yc]);
						try {
							await this.setStateAsync(sEfmCurrPath + sEfmValueIDs[yc],pEfmValues[xc][yc],true);
						}
						catch(error) {
							this.log.error(error);
						}						
					}            
					if (sEfmValueIDs[yc] == 'date') {
						pEfmValues[xc][yc] = newDate;
						this.log.debug('sEfmCurrPath: ' + sEfmCurrPath + sEfmValueIDs[yc] + ' sEfmValueIDs[' + yc.toString() +']:' + sEfmValueIDs[yc] + 'Value: ' + pEfmValues[xc][yc].toString());
					} else {
					pEfmValues[xc][yc] = 0;
					};
				};
				this.log.debug('Reset ' + pEfmPathTimePeriod[xc] + ' Counter executed');
			};
		};
		return pEfmValues;
	}

	async calcValues(p1FloatPvPower, p1FloatLoad, p1FloatExport, p1FloatImport, p1FloatBatCharge, p1FloatBatDischarge, pEfmValues) {
		const pEfmPathTimePeriod = await this.getEnergyCounterTimePeriod();
		const iPathArrayLen = pEfmPathTimePeriod.length;
		const sEfmValueIDs = await this.getValueIDs();		
		const iValueIDsArrayLen = sEfmValueIDs.length;
		var vEfmCalcValues = [[],[],[]];	
		var vEnergyDivisor = 0;
		var updateRate = this.config.updateInterval;
		if ((updateRate == 0) || (updateRate == null)) {
			updateRate = 2;
		};
		vEnergyDivisor = 3600 / updateRate;
		// Werte berechnen
		for (var xd = 0; xd < iPathArrayLen; xd++) {
			for (var yd = 0; yd < iValueIDsArrayLen; yd++) {
				switch(sEfmValueIDs[yd]) {
					case 'date':
					vEfmCalcValues[xd][yd] = pEfmValues[xd][yd].valueOf();
					break;
					case 'load':
					vEfmCalcValues[xd][yd] = pEfmValues[xd][yd] + (p1FloatLoad / vEnergyDivisor);
					break;
					case 'pv':
					vEfmCalcValues[xd][yd] = pEfmValues[xd][yd] + (p1FloatPvPower / vEnergyDivisor);
					break;
					case 'export':
					vEfmCalcValues[xd][yd] = pEfmValues[xd][yd] + (p1FloatExport / vEnergyDivisor);
					break;
					case 'import':
					vEfmCalcValues[xd][yd] = pEfmValues[xd][yd] + (p1FloatImport/ vEnergyDivisor);
					break;
					case 'selfConsumption':
					vEfmCalcValues[xd][yd] = pEfmValues[xd][yd] + ((p1FloatPvPower - p1FloatExport) / vEnergyDivisor);
					if (vEfmCalcValues[xd][yd] < 0) {
						vEfmCalcValues[xd][yd] = 0;
					};
					break;
					case 'batteryDischarge':
					vEfmCalcValues[xd][yd] = pEfmValues[xd][yd] + (p1FloatBatDischarge / vEnergyDivisor);
					break;
					case 'batteryCharge':
					vEfmCalcValues[xd][yd] = pEfmValues[xd][yd] + (p1FloatBatCharge / vEnergyDivisor);
					break;
					case 'selfConsumptionQuota':
					if (pEfmValues[xd][2] == 0 ) {
						vEfmCalcValues[xd][yd] = 0;
					} else {
						vEfmCalcValues[xd][yd] = (pEfmValues[xd][5] / pEfmValues[xd][2] * 100);
						if (vEfmCalcValues[xd][yd] > 100) {
							vEfmCalcValues[xd][yd] = 100;
						};
						if (vEfmCalcValues[xd][yd] < 0) {
							vEfmCalcValues[xd][yd] = 0;
						};
					};
					break;
					case 'autarchyQuota':
					if (pEfmValues[xd][1] == 0){
						vEfmCalcValues[xd][yd] = 100;
					} else {
						vEfmCalcValues[xd][yd] = (100 - (pEfmValues[xd][4] / pEfmValues[xd][1] * 100));
						if (vEfmCalcValues[xd][yd] > 100) {
							vEfmCalcValues[xd][yd] = 100;
						};
						if (vEfmCalcValues[xd][yd] < 0) {
							vEfmCalcValues[xd][yd] = 0;
						};
					};
					break;
				};
				//this.log.debug('ValueID: ' + sEfmValueIDs[yd] + ' (sEfmValueIDs[' + yd.toString() +']) Value: ' + pEfmValues[xd][yd].valueOf());				
			};
		};
		//this.log.debug("calcvalues executed");
		return vEfmCalcValues;
	}

	async writeValues(pEfmCalcValues) {
		const pEfmPathTimePeriod = await this.getEnergyCounterTimePeriod();
		const iPathArrayLen = pEfmPathTimePeriod.length;
		const sEfmValueIDs = await this.getValueIDs();		
		const iValueIDsArrayLen = sEfmValueIDs.length;		
		const sEnergyPathLive = await this.getEnergyPathLive();
		let sEfmCurrPath = '';
		// Werte schreiben
		for (var xe = 0; xe < iPathArrayLen; xe++) {
			sEfmCurrPath = sEnergyPathLive + '.' + pEfmPathTimePeriod[xe] + '.';
			for (var ye = 0; ye < iValueIDsArrayLen; ye++) {
				try {
					await this.setStateAsync(sEfmCurrPath + sEfmValueIDs[ye],pEfmCalcValues[xe][ye],true);
				}
				catch(error) {
					this.log.error(error + ' ValueID: ' + sEfmValueIDs[ye] + ' Value: ' + pEfmCalcValues[xe][ye]);
				}
			};
		};
		this.log.debug("writevalues executed");
	}

	async initPowerControlChannels() {
		this.log.info('PowerControlInitChannels started');
		let cfgTable = this.config.powerControlChannels;
		let counter = 0;
		if (this.supportsFeature && this.supportsFeature('ADAPTER_DEL_OBJECT_RECURSIVE')) {
			await this.delObjectAsync(this.namespace + '.loadPowerControl.channels', { recursive: true });
		}
		if (cfgTable && Array.isArray(cfgTable)) {
			this.log.info('PowerControlInitChannels started');
			for (const p in cfgTable) {
				const cfgTableEntry = cfgTable[p];								
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
		await this.setStateAsync(this.namespace + '.loadPowerControl.channels.' + cfgTableEntry.pwcChannelTitle + '.priority', {val: priority, ack: true});
		await this.setStateAsync(this.namespace + '.loadPowerControl.channels.' + cfgTableEntry.pwcChannelTitle + '.active', {val: cfgTableEntry.pwcChannelEnabled, ack: true});
		await this.setStateAsync(this.namespace + '.loadPowerControl.channels.' + cfgTableEntry.pwcChannelTitle + '.powerOn', {val: false, ack: true});
		await this.setStateAsync(this.namespace + '.loadPowerControl.channels.' + cfgTableEntry.pwcChannelTitle + '.powerValue', {val: 0, ack: true});
		await this.setStateAsync(this.namespace + '.loadPowerControl.channels.' + cfgTableEntry.pwcChannelTitle + '.shutdownDelay', {val: parseFloat(cfgTableEntry.pwcChannelShutdownDelay), ack: true});
	}

	async loadPowerControl(pFloatPvPower, pFloatLoad, pFloatExport, pFloatImport, pFloatBatCharge, pFloatBatDischarge) {		
		if (this.config.powerControlActive) {
			let powerBudget = await this.calcPowerBudget(pFloatPvPower, pFloatLoad, pFloatExport, pFloatImport, pFloatBatCharge, pFloatBatDischarge);
			let cfgTable = this.config.powerControlChannels;
			let sumPowerConsumption = 0;
			let dynamicLoadDecreaseActive = false;
			if (cfgTable && Array.isArray(cfgTable)) {				
				if (powerBudget > 0) {				
					for (const p in cfgTable) {
						const cfgTableEntry = cfgTable[p];
						if (cfgTableEntry.pwcChannelEnabled) {
							let maxPower = cfgTableEntry.pwcChannelMaxPower;
							let minPower = cfgTableEntry.pwcChannelMinPower;
							let powerStepSize = cfgTableEntry.pwcChannelStepSize;
							let shutdownDelay = cfgTableEntry.pwcChannelShutdownDelay;
							let activePowerConsumptionValue = await this.getPwcActivePowerConsumptionValue(cfgTableEntry.pwcChannelTitle);
							if (activePowerConsumptionValue == 0) {
								if ((maxPower == minPower) && (powerStepSize == 0)) {
									if (minPower <= powerBudget) {
										await this.activatePwcChannel(cfgTableEntry.pwcChannelTitle,minPower,shutdownDelay);
										powerBudget -= minPower;
										sumPowerConsumption += minPower;
									}
								} else if ((maxPower > minPower) && (powerStepSize > 0)) {
									if (minPower <= powerBudget) {
										let powerTarget = minPower;
										while (powerTarget + powerStepSize <= powerBudget) {
											powerTarget += powerStepSize;
										}
										await this.activatePwcChannel(cfgTableEntry.pwcChannelTitle,powerTarget,shutdownDelay);
										powerBudget -= powerTarget;
										sumPowerConsumption += powerTarget;
									}
								}
							} else if ((maxPower > minPower) && (powerStepSize > 0)) {
								if (powerStepSize <= powerBudget) {
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
					await this.setStateAsync(this.namespace + '.loadPowerControl.sumActiveLoad', {val: sumPowerConsumption, ack: true});
				}
				else if (powerBudget < 0) {
					let tabelCounter = cfgTable.length;
					for (let i = tabelCounter - 1; i >= 0; i--) {
						const cfgTableEntry = cfgTable[i];
						if (cfgTableEntry.pwcChannelEnabled) {
							let maxPower = cfgTableEntry.pwcChannelMaxPower;
							let minPower = cfgTableEntry.pwcChannelMinPower;
							let powerStepSize = cfgTableEntry.pwcChannelStepSize;
							let shutdownDelay = cfgTableEntry.pwcChannelShutdownDelay;
							let activePowerConsumptionValue = await this.getPwcActivePowerConsumptionValue(cfgTableEntry.pwcChannelTitle);
							if (activePowerConsumptionValue > 0) {
								if ((maxPower == minPower) && (powerStepSize == 0)) {
									if (dynamicLoadDecreaseActive == false) { 
										if (await this.deactivatePwcChannel(cfgTableEntry.pwcChannelTitle)) {
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
										if (await this.deactivatePwcChannel(cfgTableEntry.pwcChannelTitle)) {
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
				}
			}
		}
	}

	async activatePwcChannel(pwcChannelTitle,powerValue,shutdownDelay) {		
		let shutdownDelayValue = await this.getPwcShutDownDelay(pwcChannelTitle);
		await this.setStateAsync(this.namespace + '.loadPowerControl.channels.' + pwcChannelTitle + '.powerValue', {val: powerValue, ack: true});
		await this.setStateAsync(this.namespace + '.loadPowerControl.channels.' + pwcChannelTitle + '.powerOn', {val: true, ack: true});
		if (shutdownDelay > shutdownDelayValue) {
			await this.setStateAsync(this.namespace + '.loadPowerControl.channels.' + pwcChannelTitle + '.shutdownDelay', {val: shutdownDelay, ack: true});
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
		let powerTarget = 0
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

	async deactivatePwcChannel(pwcChannelTitle) {
		let shutdownDelayValue = await this.getPwcShutDownDelay(pwcChannelTitle);
		let updateInterval = parseInt(this.config.updateInterval);
		if (shutdownDelayValue - updateInterval > 0) {
			shutdownDelayValue -= updateInterval;
			await this.setStateAsync(this.namespace + '.loadPowerControl.channels.' + pwcChannelTitle + '.shutdownDelay', {val: shutdownDelayValue, ack: true});
			return false;
		} else {
			await this.setStateAsync(this.namespace + '.loadPowerControl.channels.' + pwcChannelTitle + '.powerValue', {val: 0, ack: true});
			await this.setStateAsync(this.namespace + '.loadPowerControl.channels.' + pwcChannelTitle + '.powerOn', {val: false, ack: true});
			await this.setStateAsync(this.namespace + '.loadPowerControl.channels.' + pwcChannelTitle + '.shutdownDelay', {val: 0, ack: true});
			return true;
		}
	}

	async getPwcActivePowerConsumptionValue(pwcChannelTitle) {
		try {
			let activePowerConsumption = await this.getForeignStateAsync(this.namespace + '.loadPowerControl.channels.' + pwcChannelTitle + '.powerValue');
			if (activePowerConsumption.val != null) {							
				return parseFloat(activePowerConsumption.val);
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
			let shutdownDelay = await this.getForeignStateAsync(this.namespace + '.loadPowerControl.channels.' + pwcChannelTitle + '.shutdownDelay');
			if (shutdownDelay.val != null) {							
				return parseFloat(shutdownDelay.val);
			} else {
				return 0;
			}
		} catch (error) {
			this.log.error(error);
			return 0;
		}
	}

	async getPwcSumActiveLoad() {
		try {
			let sumActiveLoad = await this.getForeignStateAsync(this.namespace + '.loadPowerControl.sumActiveLoad');
			if (sumActiveLoad.val != null) {							
				return parseFloat(sumActiveLoad.val);
			} else {
				return 0;
			}
		} catch (error) {
			this.log.error(error);
			return 0;
		}
	}

	async calcPowerBudget(pFloatPvPower, pFloatLoad, pFloatExport, pFloatImport, pFloatBatCharge, pFloatBatDischarge) {
		let exportThreshold = parseFloat(this.config.exportThreshold)/1000;
		let importThreshold = parseFloat(this.config.importThreshold)/1000;
		if ((pFloatBatDischarge > 0) || (pFloatImport > importThreshold)) {
			return (pFloatBatDischarge + pFloatImport)*-1;
		}
		if (pFloatExport > exportThreshold) {
			return pFloatExport;
		}
		return 0;
	}

	async resetShutdownDelays(cfgTable) {
		if (cfgTable && Array.isArray(cfgTable)) {			
			for (const p in cfgTable) {
				const cfgTableEntry = cfgTable[p];
				if (cfgTableEntry.pwcChannelEnabled) {					
					await this.setStateAsync(this.namespace + '.loadPowerControl.channels.' + cfgTableEntry.pwcChannelTitle + '.shutdownDelay', {val: parseInt(cfgTableEntry.pwcChannelShutdownDelay), ack: true});					
				}
			}

		}
	}

	leadingZero(num, size) {
		num = num.toString();
		while (num.length < size) num = "0" + num;
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
