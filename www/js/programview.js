/*!
 * Program view for OpenSprinkker App
 * https://github.com/opensprinklershop/
 * (c) 2024 OpenSprinklerShop
 * Released under the MIT License
 */

var programCharts = [];
var stationsRunning = 0;
var lastProgramRun = -2;
var clickedOn = -1;
var clickedMove = 0;
var scrollY = 0;

function updateProgramShowArea( page ){
	if (!checkOSVersion( 210 ))
		return;

	if (lastProgramRun == -2) {
		lastProgramRun = localStorage.getItem("lastProgramRun");
		if (lastProgramRun === undefined || lastProgramRun == -2) {
			lastProgramRun == -1;
			reset = true;
		}
	}

	var i, j, reset = false, sr = 0,
		width = window.screen.width < 400? 150 : 200;

	if (controller.programs.pd.length != programCharts.length) {
		programCharts.length = controller.programs.pd.length;
		reset = true;
	}

	var html = "<div class='ui-body ui-body-a center'><table border=1 frame=void rules=rows style='margin: 0px auto;'>";
	for (i = 0; i < controller.programs.pd.length; i++) {

		let prog = readProgram(controller.programs.pd[i]);
		var name = prog.name;

		if (prog.en) {
			html += "<tr>";
			html += "<td><div id='progChart-" + i + "'></div></td>";
			html += "<td><h2>"+name+"</h2>";
			//html += "<p>"+(prog.en?"enabled":"")+" "+(prog.weather?"weather":"");

			// Show station duration inputs
			var timeSum = 0;
			var remaining = 0;
			for ( j = 0; j < controller.stations.snames.length; j++ ) {
				if ( !Station.isMaster( j ) ) {
					time = prog.stations[ j ] || 0;
					if (time > 0) {
						timeSum += time;

						var stationIsRunning = Station.isRunning(j);
						if (stationIsRunning)
							sr++;
						html += "<button class='" +
							(stationIsRunning ? "ui-btn-active " : "") +
							"ui-shadow ui-btn-inline ui-btn ui-corner-all ui-btn-b ui-mini' id='progStation-"+i+"-"+j+"' value='"+i+"_"+j+"'>" +
							controller.stations.snames[ j ]+" ["+getDurationText( time )+"]</button>";

						pid = Station.getPID( j ) - 1;
						if (pid == i || (pid == 253 && i == lastProgramRun)) {
							//pname  = pidname( pid );

							let remainingStation = Station.getRemainingRuntime( j );
							if ( controller.status[ j ] ) {
								if (remainingStation > remaining)
									remaining = remainingStation;
							} else {
								remaining += remainingStation;
							}
						}
					}
				}
			}
			html += "</td></tr>";
		}

		var programChart = programCharts[i];
		if (!programChart) {
			programChart = {updated : 1};
			programCharts[i] = programChart;
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
			if (!running && lastProgramRun == i)
				lastProgramRun = -1;
		}
		let current = running ? (timeSum > 0 ? Math.round(remaining/timeSum * 100) : 0) : "Start";
		if (running && current > 100) current = 100;
		if (programChart.current != current) {
			programChart.current = current;
			programChart.updated++;
		}
		name = remaining > 0.01 ? sec2hms(remaining) : sec2hms(timeSum);
		if (programChart.name != name) {
			programChart.name = name;
			programChart.updated++;
		}
		if (stationsRunning != sr) {
			stationsRunning = sr;
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

		for (i = 0; i < controller.programs.pd.length; i++) {
			for ( j = 0; j < controller.stations.snames.length; j++ ) {
				if ( !Station.isMaster( j ) ) {
					page.find("#progStation-"+i+"-"+j).on( "click", function(ev) {
						let value = $( this )[0].value.split("_");
						let pid = Number(value[0]);
						let sid = Number(value[1]);
						let prog = readProgram(controller.programs.pd[pid]);
						if (Station.isRunning( sid )) {
							areYouSure( _( "Do you want to stop the selected station?" ), Station.getName( sid ), function() {
								sendToOS( "/cm?sid=" + sid + "&en=0&pw=" ).done( function() {
									Station.setPID( sid, 0 );
									Station.setRemainingRuntime( sid, 0 );
									Station.setStatus( sid, 0 );
									// Remove any timer associated with the station
									delete timers[ "station-" + sid ];
									refreshStatus();
									showerror( _( "Station has been stopped" ) );
								});
							});
						} else {
							let duration = prog.stations[ sid ] || 0;
							sendToOS( "/cm?sid=" + sid + "&en=1&t=" + duration + "&pw=", "json" ).done( function() {

								// Update local state until next device refresh occurs
								Station.setPID( sid, pid );
								Station.setRemainingRuntime( sid, duration );

								refreshStatus();
								showerror( _( "Station has been queued" ) );
							} );
						}
						return false;
					} );
				}
			}
		}
	}

	for (i = 0; i < programCharts.length; i++) {
		let programChart = programCharts[i];
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
							if (event.buttons && clickedOn == -1) {
								clickedOn = opts.config.pid;
								scrollY = top;
								clickedMove = 0;
							}
							if (clickedOn == opts.config.pid) {
								clickedMove += Math.abs(top-scrollY);
								scrollY = top;
							}
						},
						click: function(event, chartContext, opts) {
							var top = $(document).scrollTop();
							let pid = opts.config.pid;
							clickedMove += Math.abs(top-scrollY);
							scrollY = top;
							if (clickedMove > 10) {
								clickedOn = -1;
								clickedMove = 0;
								return;
							}
							clickedOn = -1;
							clickedMove = 0;

							setTimeout(function() {
								var name = controller.programs.pd[ pid ][ 5 ];

								if (pid == lastProgramRun) {
									stopAllStations( function() {
										lastProgramRun = -1;
										localStorage.setItem("lastProgramRun", lastProgramRun);
									});
								} else {
									areYouSure( _( "Are you sure you want to start") + " " + name + " " + _("now?") , "", function() {
										lastProgramRun = -1;
										areYouSure( _( "Do you wish to apply the current watering level?" ), "", function() {
											lastProgramRun = pid;
											localStorage.setItem("lastProgramRun", lastProgramRun);
											sendToOS( "/mp?pw=&pid="+pid+"&uwt=1");
											showerror( _( "Program started successfully" ) );
											refreshStatus();

										}, function() {
											lastProgramRun = pid;
											localStorage.setItem("lastProgramRun", lastProgramRun);
											sendToOS( "/mp?pw=&pid="+pid+"&uwt=0");
											showerror( _( "Program started successfully" ) );
											refreshStatus();
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
              				size: '70%',
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
									return typeof(val) === 'string'? val : formatValUnit(val, "%");
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
}
