/* global $, ApexCharts */

/*!
 * Analog Sensor API - GUI for OpenSprinkler App
 * https://github.com/opensprinklershop/
 * (c) 2023 OpenSprinklerShop
 * Released under the MIT License
 */

// Configure module
var OSApp = OSApp || {};

OSApp.ProgramView = {
	programCharts : [],
	lastProgramRun : -2,
	clickedOn : -1,
	clickedMove : 0,
	scrollY : 0,
	showing : false,
	lastWidth : 0,
	Constants: {
		SHOW_NONE : 0,
		SHOW_ZONES : 1,
		SHOW_PROGRAMS : 2,
	},
};

OSApp.ProgramView.updateProgramShowArea = function( page, visible ) {
	if (!OSApp.Firmware.checkOSVersion( 210 ))
		return;

	var i, j, reset = false, sr = 0, width;

	if (OSApp.ProgramView.lastProgramRun == -2) {
		OSApp.ProgramView.lastProgramRun = localStorage.getItem("lastProgramRun");
		if (OSApp.ProgramView.lastProgramRun === undefined || OSApp.ProgramView.lastProgramRun == -2) {
			OSApp.ProgramView.lastProgramRun == -1;
			reset = true;
		}
	}

	width = window.screen.width < 400? 150 : 200;
	if (width != OSApp.ProgramView.lastWidth) {
		OSApp.ProgramView.lastWidth = width;
		reset = true;
	}

	if (OSApp.currentSession.controller.programs.pd.length != OSApp.ProgramView.programCharts.length) {
		OSApp.ProgramView.programCharts.length = OSApp.currentSession.controller.programs.pd.length;
		reset = true;
	}

	if (visible != OSApp.ProgramView.showing) {
		OSApp.ProgramView.showing = visible;
		reset = true;
	}

	if (!visible)
	{
		page.find("#os-program-show").html("");
		return;
	}

	var html = "<div class='ui-body ui-body-a center'><table border=1 frame=void rules=rows style='margin: 0px auto;'>";
	for (i = 0; i < OSApp.currentSession.controller.programs.pd.length; i++) {

		let prog = OSApp.Programs.readProgram(OSApp.currentSession.controller.programs.pd[i]);
		var name = prog.name;

		if (prog.en) {
			html += "<tr>";
			html += "<td><div id='progChart-" + i + "'></div></td>";
			html += "<td><h2>"+name+"</h2>";
			//html += "<p>"+(prog.en?"enabled":"")+" "+(prog.weather?"weather":"");

			// Show station duration inputs
			var timeSum = 0, timeSums = [];
			var remaining = 0;
			for ( j = 0; j < OSApp.currentSession.controller.stations.snames.length; j++ ) {
				if ( !OSApp.Stations.isMaster( j ) ) {
					let time = prog.stations[ j ] || 0;
					if (time > 0) {
						let gid = OSApp.currentSession.controller.stations.stn_grp ? OSApp.currentSession.controller.stations.stn_grp[ j ] : 0;
						if (!timeSums[ gid ])
							timeSums[ gid ] = time;
						else
							timeSums[ gid ] += time;

						var stationIsRunning = OSApp.Stations.isRunning(j);
						if (stationIsRunning)
							sr++;
						html += "<button class='" +
							(stationIsRunning ? "ui-btn-active " : "") +
							"ui-shadow ui-btn-inline ui-btn ui-corner-all ui-btn-b ui-mini' id='progStation-"+i+"-"+j+"' value='"+i+"_"+j+"'>" +
							OSApp.currentSession.controller.stations.snames[ j ]+" ["+OSApp.Dates.getDurationText( time )+"]</button>";

						let pid = OSApp.Stations.getPID( j ) - 1;
						if (pid == i || (pid == 253 && i == OSApp.ProgramView.lastProgramRun)) {
							//pname  = pidname( pid );

							let remainingStation = OSApp.Stations.getRemainingRuntime( j );
							if ( OSApp.currentSession.controller.status[ j ] ) {
								if (remainingStation > remaining)
									remaining = remainingStation;
							} else {
								remaining += remainingStation;
							}
						}
					}
				}
			}
			for (let t of timeSums) {
				if (t > timeSum) timeSum = t;
			}
			html += "</td></tr>";
		}

		var programChart = OSApp.ProgramView.programCharts[i];
		if (!programChart) {
			programChart = {updated : 1};
			OSApp.ProgramView.programCharts[i] = programChart;
		}
		else programChart.updated = 0;

		if (programChart.en != prog.en) {
			programChart.en = prog.en;
			reset = true;
		}
		remaining = Math.round((remaining-1) / 5) * 5;
		if (programChart.remaining != remaining) {
			programChart.remaining = remaining;
			programChart.updated++;
		}
		let running = remaining > 0.01;
		if (programChart.running != running) {
			programChart.running = running;
			programChart.updated++;
			if (!running && OSApp.ProgramView.lastProgramRun == i)
				OSApp.ProgramView.lastProgramRun = -1;
		}
		let current = running ? (timeSum > 0 ? Math.round(remaining/timeSum * 100) : 0) : "Start";
		if (running && current > 100) current = 100;
		if (programChart.current != current) {
			programChart.current = current;
			programChart.updated++;
		}
		name = remaining > 0.01 ? OSApp.Dates.sec2hms(remaining) : OSApp.Dates.sec2hms(timeSum);
		if (programChart.name != name) {
			programChart.name = name;
			programChart.updated++;
		}
		if (programChart.stationsRunning != sr) {
			programChart.stationsRunning = sr;
			reset = true;
		}
		if (reset) {
			programChart.chart = null;
			programChart.updated++;
		}

		//prog.en
		//prog.weather
	}
	if (reset) {
		html += "</table></div>";
		page.find("#os-program-show").html(html);

		for (i = 0; i < OSApp.currentSession.controller.programs.pd.length; i++) {
			for ( j = 0; j < OSApp.currentSession.controller.stations.snames.length; j++ ) {
				if ( !OSApp.Stations.isMaster( j ) ) {
					page.find("#progStation-"+i+"-"+j).on( "click", function(_ev) {
						let value = $( this )[0].value.split("_");
						let pid = Number(value[0]);
						let sid = Number(value[1]);
						let prog = OSApp.Programs.readProgram(OSApp.currentSession.controller.programs.pd[pid]);
						if (OSApp.Stations.isRunning( sid )) {
							OSApp.UIDom.areYouSure( OSApp.Language._( "Do you want to stop the selected station?" ), OSApp.Stations.getName( sid ), function() {
								OSApp.Firmware.sendToOS( "/cm?sid=" + sid + "&en=0&pw=" ).done( function() {
									OSApp.Stations.setPID( sid, 0 );
									OSApp.Stations.setRemainingRuntime( sid, 0 );
									OSApp.Stations.setStatus( sid, 0 );
									// Remove any timer associated with the station
									delete OSApp.uiState.timers[ "station-" + sid ];
									OSApp.Status.refreshStatus();
									OSApp.Errors.showError( OSApp.Language._( "Station has been stopped" ) );
								});
							});
						} else {
							let duration = prog.stations[ sid ] || 0;
							OSApp.Firmware.sendToOS( "/cm?sid=" + sid + "&en=1&t=" + duration + "&pw=", "json" ).done( function() {

								// Update local state until next device refresh occurs
								OSApp.Stations.setPID( sid, pid );
								OSApp.Stations.setRemainingRuntime( sid, duration );

								OSApp.Status.refreshStatus();
								OSApp.Errors.showError( OSApp.Language._( "Station has been queued" ) );
							} );
						}
						return false;
					} );
				}
			}
		}
	}

	for (i = 0; i < OSApp.ProgramView.programCharts.length; i++) {
		let programChart = OSApp.ProgramView.programCharts[i];
		if (!programChart.en) continue;
		var chart = programChart.chart;
		if (!chart) {
			let options = {
				pid : i,
				clicked : 0,
				chart: {
					width: width,
					height: 200,
					parentHeightOffset: 0,
					type: "radialBar",
					animations: {
						enabled: true,
						dynamicAnimation: {
							enabled: true
						}
					},
					events: {
						//Avoid drag-click false clicking:
						mouseMove: function(event, chartContext, opts) {
							var top = $(document).scrollTop();
							if (event.buttons && OSApp.ProgramView.clickedOn == -1) {
								OSApp.ProgramView.clickedOn = opts.config.pid;
								OSApp.ProgramView.scrollY = top;
								OSApp.ProgramView.clickedMove = 0;
							}
							if (OSApp.ProgramView.clickedOn == opts.config.pid) {
								OSApp.ProgramView.clickedMove += Math.abs(top-scrollY);
								OSApp.ProgramView.scrollY = top;
							}
						},
						click: function(event, chartContext, opts) {
							var top = $(document).scrollTop();
							let pid = opts.config.pid;
							OSApp.ProgramView.clickedMove += Math.abs(top-scrollY);
							OSApp.ProgramView.scrollY = top;
							if (OSApp.ProgramView.clickedMove > 10) {
								OSApp.ProgramView.clickedOn = -1;
								OSApp.ProgramView.clickedMove = 0;
								return;
							}
							OSApp.ProgramView.clickedOn = -1;
							OSApp.ProgramView.clickedMove = 0;

							setTimeout(function() {
								var name = OSApp.currentSession.controller.programs.pd[ pid ][ 5 ];

								if (pid == OSApp.ProgramView.lastProgramRun) {
									OSApp.Stations.stopAllStations( function() {
										OSApp.ProgramView.lastProgramRun = -1;
										localStorage.setItem("lastProgramRun", OSApp.ProgramView.lastProgramRun);
									});
								} else {
									OSApp.UIDom.areYouSure( OSApp.Language._( "Are you sure you want to start") + " " + name + " " + OSApp.Language._("now?") , "", function() {
										OSApp.ProgramView.lastProgramRun = -1;
										OSApp.UIDom.areYouSure( OSApp.Language._( "Do you wish to apply the current watering level?" ), "", function() {
											OSApp.ProgramView.lastProgramRun = pid;
											localStorage.setItem("lastProgramRun", OSApp.ProgramView.lastProgramRun);
											OSApp.Firmware.sendToOS( "/mp?pw=&pid="+pid+"&uwt=1");
											OSApp.Errors.showError( OSApp.Language._( "Program started successfully" ) );
											OSApp.Status.refreshStatus();

										}, function() {
											OSApp.ProgramView.lastProgramRun = pid;
											localStorage.setItem("lastProgramRun", OSApp.ProgramView.lastProgramRun);
											OSApp.Firmware.sendToOS( "/mp?pw=&pid="+pid+"&uwt=0");
											OSApp.Errors.showError( OSApp.Language._( "Program started successfully" ) );
											OSApp.Status.refreshStatus();
										});
									});
								}
							}, 100);
						  }
					}
				},
				series: [programChart.current],
				plotOptions: {
					radialBar: {
						hollow: {
							margin: 0,
              				size: '60%',
              				background: '#fff',
							position: 'front',
							dropShadow: {
								enabled: true,
								top: 3,
								left: 0,
								blur: 4,
								opacity: 0.5
							},
						},
						track: {
							background: '#fff',
              				strokeWidth: '67%',
              				margin: 0, // margin is in pixels
							dropShadow: {
								enabled: true,
								top: -3,
								left: 0,
								blur: 4,
								opacity: 0.7
							}
						},
						dataLabels: {
							showOn: "always",
							name: {
								offsetY: -10,
								show: true,
								color: "#222",
								fontSize: "13px"
							},
							value: {
								offsetY: 1,
								color: "#111",
								fontSize: "30px",
								show: true,
								formatter: function (val) {
									return typeof(val) === 'string'? val : OSApp.Analog.formatValUnit(val, "%");
								}
							}
						}
					}
				},
				fill: {
					type: 'gradient',
					gradient: {
					  shade: 'dark',
					  type: 'horizontal',
					  shadeIntensity: 0.5,
					  gradientToColors: ['#ABE5A1'],
					  inverseColors: true,
					  opacityFrom: 1,
					  opacityTo: 1,
					  stops: [0, 100]
					}
				  },
				stroke: {
					lineCap: "round",
				},
				labels: [programChart.name]
			};

			var sel = document.querySelector("#progChart-" + i);
			if (sel) {
				chart = new ApexCharts(sel, options);
				chart.render();
				programChart.chart = chart;
			}
		} else {
			if (programChart.updated) {
				chart.updateOptions({
					series: [programChart.current],
					chart: {width: width},
					labels: [programChart.name] },
					false, true );
			}
		}
	}
};
