<?php
#Start session
if(!isset($_SESSION)) session_start(); 

#Tell main we are calling it
define('Sprinklers', TRUE);

#Source required files
require_once "main.php";
?>

<!DOCTYPE html>
<html>
	<head>
    	<title>Sprinkler System</title> 
    	<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
        <meta name="viewport" content="initial-scale=1.0,user-scalable=no,maximum-scale=1" media="(device-height: 568px)" />
    	<meta content="yes" name="apple-mobile-web-app-capable">
        <meta name="apple-mobile-web-app-title" content="Sprinklers">
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
        <meta http-equiv="content-type" content="text/html; charset=utf-8" />
    	<link rel="apple-touch-icon" href="img/icon.png">
        <link href='//fonts.googleapis.com/css?family=Lato:400,700,900,400italic' rel='stylesheet' type='text/css'>
        <link rel="stylesheet" type="text/css" href="css/jquery.mobile.flatui.min.css" id="theme" />
        <link rel="stylesheet" href="css/main.css" />
        <link rel="shortcut icon" href="img/favicon.ico">
        <script type="text/javascript">
            var _gaq = _gaq || [];
            _gaq.push(['_setAccount', 'UA-40111352-4']);
            _gaq.push(['_trackPageview']);
            (function() {
                var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
                ga.src = ('https:' == document.location.protocol ? 'https://ssl' : 'http://www') + '.google-analytics.com/ga.js';
                var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(ga, s);
            })();
        </script>
    </head> 
    <body style="display:none">
        <div data-role="page" id="start" data-theme="a"></div>
                    
        <div data-role="page" id="sprinklers">
            <div data-theme="a" data-role="header" data-position="fixed" data-tap-toggle="false">
                <a data-icon="bars" data-iconpos="notext" href="#sprinklers-settings"></a>
                <a data-icon="gear" data-iconpos="notext" href="#settings">Settings</a>
                <h3 style="margin:0"><img height="40px" width="159px" src="img/logo.png" /></h3>
            </div>
            <div data-role="content" style="padding-top:0px">
                <div id="footer-running">
                </div>
                <ul data-role="listview" data-inset="true" id="weather-list">
                    <li data-role="list-divider">Weather</li>
                    <li><div id="weather"></div></li>
                </ul>
                <ul data-role="listview" data-inset="true" id="info-list">
                    <li data-role="list-divider">Information</li>
                    <li><a href="#status" data-onclick="get_status();">Current Status</a></li>
                    <li><a href="#preview">Preview Programs</a></li>
                </ul>
                <ul data-role="listview" data-inset="true" id="program-control-list">
                    <li data-role="list-divider">Program Control</li>
                    <li><a href="#programs" data-onclick="get_programs();">Edit Programs</a></li>
                    <li><a href="#manual" data-onclick="get_manual();">Manual Control</a></li>
                    <li><a href="#raindelay">Rain Delay</a></li>
                    <li><a href="#runonce" data-onclick="get_runonce();">Run-Once Program</a></li>
                    <li><a href="#" data-onclick="rsn();">Stop All Stations</a></li>
                </ul>
            </div>
            <div data-role="panel" id="sprinklers-settings" data-position-fixed="true" data-theme="a">
                <ul data-role="listview" data-theme="a">
                    <li>
                        <div class="ui-grid-a">
                            <div class="ui-block-a"><br>
                                <label for="theme-select">Theme</label>
                            </div>
                            <div class="ui-block-b">
                                <select name="theme-select" id="s-theme-select" data-role="slider">
                                    <option value="legacy">Legacy</option>
                                    <option value="flat">Flat</option>
                                </select>
                            </div>
                        </div>
                    </li>
                    <li data-icon="gear"><a href="#" data-onclick="change_info();">Change OS IP/Password</a></li>
                    <li data-icon="delete"><a href="#" data-onclick="remove_info();">Remove OS IP/Password</a></li>
                    <li data-icon="forward"><a href="#" data-onclick="export_config();">Export Configuration</a></li>
                    <li data-icon="back"><a href="#" data-onclick="import_config();">Import Configuration</a></li>
                    <li data-icon="info"><a href="#about">About</a></li>
                </ul>
            </div>
        </div>

        <div data-role="page" id="status">
            <div data-theme="a" data-role="header" data-position="fixed" data-tap-toggle="false">
                <h3>Current Status</h3>
                <a href="#sprinklers" data-onclick="gohome();" data-icon="back">Back</a>
                <a href="#" data-onclick="get_status();" data-icon="refresh">Refresh</a>
            </div>
            <div data-role="content">
                <p id="status_header"></p>
                <ul data-role="listview" data-inset="true" id="status_list">
                </ul>
                <p id="status_footer"></p>
            </div>
        </div>

        <div data-role="page" id="manual">
            <div data-theme="a" data-role="header" data-position="fixed" data-tap-toggle="false">
                <h3>Manual Control</h3>
                <a href="#" data-onclick="gohome();" data-icon="back">Back</a>
            </div>
            <div data-role="content">
                <p style="text-align:center">With manual mode turned on, tap a station to toggle it.</p>
                <ul data-role="listview" data-inset="true">
                    <li data-role="fieldcontain">
                        <label for="mmm"><b>Manual Mode</b></label>
                        <select name="mmm" id="mmm" data-role="slider">
                            <option value="off">Off</option>
                            <option value="on">On</option>
                        </select>
                    </li>
                </ul>
                <ul data-role="listview" data-inset="true" id="mm_list">
                </ul>
            </div>
        </div>

        <div data-role="page" id="runonce">
            <div data-theme="a" data-role="header" data-position="fixed" data-tap-toggle="false">
                <h3>Run-Once Program</h3>
                <a href="#sprinklers" data-onclick="gohome();" data-icon="back">Back</a>
                <a href="#" data-onclick="submit_runonce();">Submit</a>
            </div>
            <div data-role="content" id="runonce_list">
            </div>
        </div>

        <div data-role="page" id="programs">
            <div data-theme="a" data-role="header" data-position="fixed" data-tap-toggle="false">
                <h3>Programs</h3>
                <a href="#sprinklers" data-onclick="gohome();" data-icon="back">Back</a>
                <a href="#" data-onclick="add_program();" data-icon="plus">Add</a>
            </div>
            <div data-role="content" id="programs_list">
            </div>
        </div>

        <div data-role="page" id="addprogram">
            <div data-theme="a" data-role="header" data-position="fixed" data-tap-toggle="false">
                <h3>Add Program</h3>
                <a href="#programs" data-onclick="get_programs();" data-icon="back">Back</a>
                <a href="#" data-onclick="submit_program('new');">Submit</a>
            </div>
            <div data-role="content" id="newprogram">
            </div>
        </div>

        <div data-role="page" id="raindelay">
            <div data-theme="a" data-role="header" data-position="fixed" data-tap-toggle="false">
                <h1>Rain Delay</h1>
                <a href="#sprinklers" data-onclick="gohome();" data-icon="back">Back</a>
            </div>
            <div data-role="content">
                <p style="text-align:center">Rain delay allows you to disable all programs for a set duration.</p>
                <ul data-role="listview" data-inset="true">
                    <li data-role="list-divider">Manual Rain Delay</li>
                    <li>
                        <p class="rain-desc">Enable manual rain delay by entering a value into the input below. To turn off a currently enabled rain delay use a value of 0.</p>
                        <form action="javascript:raindelay()">
                            <div data-role="fieldcontain">
                                <label for="delay">Duration (in hours):</label>
                                <input type="number" pattern="[0-9]*" data-highlight="true" data-type="range" min="0" max="96" id="delay" value="0" />
                            </div>
                            <input type="submit" value="Submit" data-theme="a" />
                        </form>
                    </li>
                </ul>
            </div>
        </div>

        <div data-role="page" id="settings">
            <div data-theme="a" data-role="header" data-position="fixed" data-tap-toggle="false">
                <h3>Settings</h3>
                <a href="#sprinklers" data-onclick="gohome();" data-icon="back">Back</a>
            </div>
            <div data-role="content">
                <ul data-role="listview" data-inset="true">
                    <li><a href="#" data-onclick="show_settings();">Device Options</a></li>
                    <li><a href="#" data-onclick="show_stations();">Edit Stations</a></li>
                </ul>
                <ul data-role="listview" data-inset="true">
                    <li data-role="list-divider">System Control</li>
                    <li data-role="fieldcontain">
                        <label for="mm"><b>Manual Mode</b></label>
                        <select name="mm" id="mm" data-role="slider">
                            <option value="off">Off</option>
                            <option value="on">On</option>
                        </select>
                    </li>
                    <li data-role="fieldcontain">
                        <label for="en"><b>Operation</b></label>
                        <select name="en" id="en" data-role="slider">
                            <option value="off">Off</option>
                            <option value="on">On</option>
                        </select>
                    </li>
                    <li data-icon="alert"><a href="#" data-onclick="rbt();">Reboot OpenSprinkler</a></li>
                </ul>                
            </div>
        </div>

        <div data-role="page" id="os-settings">
            <div data-theme="a" data-role="header" data-position="fixed" data-tap-toggle="false">
                <h3>OS Settings</h3>
                <a href="#settings" data-icon="back">Back</a>
                <a href="#" data-onclick="submit_settings();">Submit</a>
            </div>
            <div data-role="content">
                <ul data-role="listview" data-inset="true" id="os-settings-list">
                </ul>
            </div>
        </div>

        <div data-role="page" id="os-stations">
            <div data-theme="a" data-role="header" data-position="fixed" data-tap-toggle="false">
                <h3>Edit Stations</h3>
                <a href="#settings" data-icon="back">Back</a>
                <a href="#" data-onclick="submit_stations();">Submit</a>
            </div>
            <div data-role="content">
                <ul data-role="listview" data-inset="true" id="os-stations-list">
                </ul>
            </div>
        </div>

        <div data-role="page" id="preview">
            <div data-theme="a" data-role="header" data-position="fixed" data-tap-toggle="false">
                <h3>Program Preview</h3>
                <a href="#sprinklers" data-onclick="gohome();" data-icon="back">Back</a>
            </div>
            <div data-role="content">
                <div id="preview_header">
                    <a href="#" data-onclick="changeday(-1);"><img src="img/moveleft.png" /></a>
                    <input style="text-align:center" type="date" name="preview_date" id="preview_date" />
                    <a href="#" data-onclick="changeday(1);"><img src="img/moveright.png" /></a>
                </div>
                <div id="timeline"></div>
                <div id="timeline-navigation" style="display:none;width:144px;margin:0 auto">
                    <div class="timeline-navigation-zoom-in" onclick="timeline.zoom(0.4)" title="Zoom in"></div>
                    <div class="timeline-navigation-zoom-out" onclick="timeline.zoom(-0.4)" title="Zoom out"></div>
                    <div class="timeline-navigation-move-left" onclick="timeline.move(-0.2)" title="Move left"></div>
                    <div class="timeline-navigation-move-right" onclick="timeline.move(0.2)" title="Move right"></div>
                </div>
            </div>
        </div>

        <div data-role="page" id="about">
            <div data-theme="a" data-role="header" data-position="fixed" data-tap-toggle="false">
                <h3>About</h3>
                <a href="#sprinklers" data-onclick="gohome();" data-icon="back">Back</a>
            </div>
            <div data-role="content">
                <div data-role="collapsible-set">
                    <div data-role="collapsible">
                        <h3>Background</h3>
                        <p>I, Samer Albahra, am a medical school graduate, currently doing a pathology residency at UTHSCSA. I enjoy making mobile applications in my spare time and was excited when I first discovered the OpenSprinkler, an open-source Internet based sprinkler system, which lacked a truly mobile interface.</p>
                        <p>I decided to add a mobile front-end using jQuery Mobile. There were a few things I wanted to accomplish:</p>
                        <ul><li>Large on/off buttons in manual mode</li><li>Easy slider inputs for any duration input</li><li>Compatibility between many/all devices</li><li>Easy feedback of current status</li><li>Easy program input/modification</li></ul>
                        <p>Fortunately, I had a lot of feedback on Ray's forums and now have an application that has been tested across many devices and installed in many unique environments.</p>
                        <p>I fully support every feature of the OpenSprinkler and also the OpenSprinkler Pi (using the interval program).</p>
                        <p>This copy of the web application is unique because it requires no install and only requires access to the OpenSprinkler by opening a port on your home router.</p>
                    </div>
                    <div data-role="collapsible">
                        <h3>Version History</h3>
                            <p>Version 2.01</p><ul><li>Added ability to change themes between the old one and newer, flat theme</li><li>Fixed bug loading Preview on IE8 and below</li><li>Fixed bug with timers after leaving the current status page which sent the user back to the current status page</li></ul>
                            <p>Version 2.00</p><ul><li>Redesigned theme</li><li>Fixed bug with run-once quick program location</li><li>Added highlight to sliders in settings page</li><li>Fixed program preview next/previous icons</li></ul>
                            <p>Version 1.23</p><ul><li>Fixed bug with comma in station name</li><li>Fixed problem handling unicode encoding from interval program</li><li>Minified settings and edit stations pages</li><li>Removed settings and edit station redudant headers</li><li>Added shortcut to reset sliders on runonce page from dropdown by picking Quick Programs</li><li>Fixed dropdown on runonce page not refreshing after the first page load</li><li>Fixed bug with program preview where master station was 1 minute short</li><li>Programs are now selectable within run-once programs to launch an ad-hoc program</li><li>Minified edit program page</li></ul>
                            <p>Version 1.22</p><ul><li>Fixed broken timers when status page is opened during station delay</li><li>Added live clock to status page</li><li>Fixed bug with manual mode timer on status page</li><li>Added running program information to status page including remaining time</li></ul>
                            <p>Version 1.21</p><ul><li>Show station delay notification on status page</li><li>Some more imporvments to status page layout</li><li>Slight adjustment of staus icon/padding</li><li>Unhighlight stations when switching manual off</li><li>Show multiple station information in status bar</li><li>Running timers for status page</li><li>Increased AJAX timer</li></ul>
                            <p>Version 1.20</p><ul><li>Change runonce button order</li><li>Reflowed status page to emphasize station status</li><li>Status bar improvements</li><li>Detect device standby and refresh timer appropriately</li><li>Center weather header</li></ul>
                            <p>Version 1.19</p><ul><li>Stricter check for OpenSprinkler IP</li><li>Fix bug with status bar on Firefox</li><li>Updated favicon</li><li>Fixed problem with status bar not moving with side panel</li><li>New animation for weather box</li><li>Highlight program if disabled in the edit program selection</li><li>Rememeber runonce values</li></ul>
                            <p>Version 1.18</p><ul><li>Fixed a bug with wrongly cached location when changing device</li><li>Now shows loader when weather and current status are being polled</li><li>Fixed weather container not hiding on failed weather poll</li><li>Check program status inbetween stations by polling against the station delay</li><li>Relocated current status notification</li><li>Relocated weather information</li><li>Added favicon</li><li>Updated splash screens</li><li>Changed page header to show logo</li><li>Changed app icon to logo</li></ul>
                            <p>Version 1.17</p><ul><li>Added home screen notification of currently running program and station</li><li>Reordered main menu</li>Added confirmation for stop all stations</li></ul>
                            <p>Version 1.16</p><ul><li>Fixed a bug with the next/previous buttons in the preview programs page</li><li>Changed maximum extension boards to 5</li><li>Consolidated all settings and options into one page</li><li>Redesigned the rain delay into a page with descriptions</li><li>Moved preivew navigation below the timeline</li><li>Added mouseover text for weather icon</li></ul>
                            <p>Version 1.15</p><ul><li>Fixed a bug generating preview date on single digit days</li><li>Added previous/next day shortcut on preview page</li><li>Fixed bug importing location</li><li>Backup and restore master operation bits</li><li>Reduce HTTP get requests to OpenSprinkler</li><li>Added the ability to toggle master activation per station if a master is set</li><li>Updated current status to show which program is running or scheduled to run a station</li><li>Displays the remaining time for running/scheduled stations on status page</li><li>Fix bug getting WOEID using location with commas</li><li>Added navigation options on preview timeline since Android couldn't navigate otherwise</li><li>Fixed program selection on the preview page for iOS</li><li>Added timeout to frontend with error message if server takes too long to reply</li><li>Added timeout on server side to prevent lockouts</li><li>Remove weather icon location if no status found</li></ul>
                            <p>Version 1.14</p><ul><li>Scroll to page top on program deletion</li><li>Style programs and master station uniquely</li><li>Show master station in the program preview</li><li>Properly show disabled programs in preview when rain delay is set</li><li>Moved date selector from header to content on preview page</li><li>Allow programs to be selected in preview for edit</li><li>Hide error message when no weather is found (when no location is set)</li><li>Removed Safari callout and copy/paste for mobile</li></ul>
                            <p>Version 1.13</p><ul><li>Replaced tips with local weather conditions</li><li>Moved settings option to the top-right of the main page header</li></ul>
                            <p>Version 1.12</p><ul><li>Added description to manual mode page</li><li>Removed icon next to stations on manual mode page and centered text</li><li>Moved settings out of side panel and reorganized home menu</li><li>Removed swipe gesture for side panel</li><li>Fixed rendering of cancel button on change OS IP/password page</li></ul>
                            <p>Version 1.11</p><ul><li>Added custom confirmation dialogs instead of using javascript's native confirm's</li><li>Made side panel static code to simplify future modifications</li><li>Minified timeline resources</li><li>Removed javascript psuedo protocol calls and added href calls for C-grade browsers</li><li>Merged program generation functions, reducing code base</li><li>Removed page transitions</li></ul>
                            <p>Version 1.10</p><ul><li>Added a visual preview to replace the text based version</li><li>Fixed a bug where the UTC date was used for the intial preview date</li><li>Fixed a bug setting the interval time by changing maximum to 1439 minutes</li></ul>
                            <p>Version 1.09</p><ul><li>Fixed bug when importing programs</li><li>Delete all programs before import</li><li>Properly scoped all local variables</li><li>Fixed a problem importing data</li><li>Change document title to add webtitle prefix to each page</li></ul>
                            <p>Version 1.08</p><ul><li>Fixed sequential program preview on the OpenSprinkler Pi</li><li>Added about page</li><li>Moved donation button to the about page</li></ul>
                            <p>Version 1.07</p><ul><li>Fixed all the glitches I could find in the page height being set incorrectly when the keyboard came up</li><li>Removed the hack on program/add program pages that triggered a scroll</li><li>Added a cancel button to the change IP/Password page</li><li>Auto fill in known information on change IP/Password page</li><li>Updated to jQuery 1.3.1</li></ul>
                            <p>Version 1.06</p><ul><li>Changed how the timezone was displayed in status page and should work correctly on all versions</li><li>Added option to empty local storage to delete the IP and password saved in the browser (in case a user logs in using a public browser)</li></ul>
                            <p>Version 1.05</p><ul><li>Fixed a bug when you first type your IP/Password the enable/manual mode toggles don't update</li></ul>
                            <p>Version 1.04</p><ul><li>Fixed a bug in timezone display on status page</li><li>Fixed a bug displaying hashes as page changes</li><li>Fixed a bug with some flickering on load</li><li>Added the ability to change OS IP/PW via the panel</li><li>Fixed the panel not showing on slide gesture</li></ul>
                            <p>Version 1.03</p><ul><li>Visual bug fixes</li></ul>
                            <p>Version 1.02</p><ul><li>Switched from storing data centrally to using local storage</li></ul>
                            <p>Version 1.01</p><ul><li>First public release</li></ul>
                    </div>
                    <div data-role="collapsible" data-collapsed="false">
                        <h3>Donate</h3>
                            <p style="text-align:center;overflow: visible;white-space: normal;">This web app has been developed by Samer Albahra. If you find it useful please donate to him by clicking the button below.</p>
                            <form style='text-align:center' action="https://www.paypal.com/cgi-bin/webscr" method="post" target="_blank">
                                <input type="hidden" name="cmd" value="_s-xclick">
                                <input type="hidden" name="hosted_button_id" value="89M484QR2TCFJ">
                                <input type="image" src="https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif" border="0" name="submit" alt="PayPal - The safer, easier way to pay online!">
                                <img alt="" border="0" src="https://www.paypalobjects.com/en_US/i/scr/pixel.gif" width="1" height="1">
                            </form>
                    </div>
                </div>
                <p id='versions'>
                    Mobile Version: 2.01
                </p>
            </div>
        </div>

        <div data-role="dialog" id="sure" data-title="Are you sure?">
            <div data-role="content">
                <h3 class="sure-1" style="text-align:center"></h3>
                <p class="sure-2" style="text-align:center"></p>
                <a class="sure-do" data-role="button" data-theme="b" href="#">Yes</a>
                <a class="sure-dont" data-role="button" data-theme="c" href="#">No</a>
            </div>
        </div>

        <div data-role="page" id="addnew">
            <div data-role="header" data-position="fixed" data-tap-toggle="false">
                <h1>New Device</h1>
                <a class="ui-btn-right" href="javascript:submit_newuser()">Submit</a>
           </div>
            <div data-role="content" style="top:28px">
                <form action="javascript:submit_newuser()" method="post" id="newuser">
                    <p style="text-align:center">Note: OpenSprinkler IP can be either an IP or hostname. You can also specify a port by using IP:Port</p>
                    <ul data-inset="true" data-role="listview">
                        <li data-role="list-divider">OpenSprinkler Configuration</li>
                        <li>
                            <div data-role="fieldcontain">
                                <label for="os_ip">Open Sprinkler IP:</label>
                                <input type="text" name="os_ip" id="os_ip" placeholder="home.dyndns.org:8080" />
                                <label for="os_pw">Open Sprinkler Password:</label>
                                <input type="password" name="os_pw" id="os_pw" value="" />
                            </div>
                        </li>
                    </ul>
                    <input type="submit" value="Submit" />
                </form>
            </div>
        </div>
        <script src="//ajax.googleapis.com/ajax/libs/jquery/1.9.1/jquery.min.js"></script>
        <script src="js/main.js"></script>
        <script src="//cdnjs.cloudflare.com/ajax/libs/jquery-mobile/1.3.1/jquery.mobile.min.js"></script>
        <script async type="text/javascript" src="js/timeline.js"></script>
    </body>
</html>