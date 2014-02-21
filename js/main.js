//After jQuery mobile is loaded set intial configuration
$(document).one("mobileinit", function(e){
    $.mobile.defaultPageTransition = 'fade';
    $.mobile.hashListeningEnabled = false;
});

//When the start page is intialized show the body (this prevents the flicker as jQuery mobile loads to process the page)
$("#start").one("pagecreate",function(e){
    $("#addnew").enhanceWithin().popup();
    $("body").show();
});

//On intial load check if a valid token exists, for auto login
$("#start").one("pageshow",function(){
    if (!check_configured()) {
        $("#addnew").popup("open");
    }
    if (window.curr_ip !== undefined) newload();

});

//Define option names based on ID
window.keyNames = {"tz":1,"ntp":2,"hp0":12,"hp1":13,"ar":14,"ext":15,"seq":16,"sdt":17,"mas":18,"mton":19,"mtof":20,"urs":21,"rso":22,"wl":23,"ipas":25};

//Insert the startup images for iOS
(function(){
    var p, l, r = window.devicePixelRatio, h = window.screen.height;
    if (navigator.platform === "iPad") {
            p = r === 2 ? "img/startup-tablet-portrait-retina.png" : "img/startup-tablet-portrait.png";
            l = r === 2 ? "img/startup-tablet-landscape-retina.png" : "img/startup-tablet-landscape.png";
            document.write('<link rel="apple-touch-startup-image" href="'+l+'" media="screen and (orientation: landscape)"><link rel="apple-touch-startup-image" href="'+p+'" media="screen and (orientation: portrait)">');
    } else {
            p = r === 2 ? (h === 568 ? "img/startup-iphone5-retina.png" : "img/startup-retina.png") : "img/startup.png";
            document.write('<link rel="apple-touch-startup-image" href="'+p+'">');
    }
})()

function newload() {
    //Create object which will store device data
    window.device = new Object;
    update_device(function(){
        if (window.device.settings.en == "1") $("#en").prop("checked",true);
        if (window.device.settings.mm == "1") $("#mm,#mmm").prop("checked",true);
        update_weather();
        changePage("#sprinklers");
    });
}

function update_device(callback) {
    $.when(
        $.getJSON("http://"+window.curr_ip+"/jp",function(programs){
            window.device.programs = programs;
        }),
        $.getJSON("http://"+window.curr_ip+"/jn",function(stations){
            window.device.stations = stations;
        }),
        $.getJSON("http://"+window.curr_ip+"/jo",function(options){
            window.device.options = options;
        }),
        $.getJSON("http://"+window.curr_ip+"/js",function(status){
            window.device.status = status.sn;
        }),
        $.getJSON("http://"+window.curr_ip+"/jc",function(settings){
            window.device.settings = settings;
        })
    ).then(callback);
}

function check_configured() {
    if (localStorage.getItem("os_ip") !== null && localStorage.getItem("os_pw") !== null) {
        /* Migrate users to new multisite system */
        sites = new Object();
        sites["Migrated"] = new Object();
        localStorage.setItem("current_site","Migrated");

        sites["Migrated"]["os_ip"] = window.curr_ip = localStorage.getItem("os_ip");
        sites["Migrated"]["os_pw"] = window.curr_pw = localStorage.getItem("os_pw");

        localStorage.setItem("sites",JSON.stringify(sites));

        update_site_list(["Migrated"]);

        localStorage.removeItem("os_ip");
        localStorage.removeItem("os_pw");
        return true;
    }

    var sites = getsites();
    var current = localStorage.getItem("current_site");

    if (sites === null) return false;

    var names = Object.keys(sites);

    if (!names.length) return false;

    if (current === null || !current in sites) {
        /* Present dialog to select site */
        site_select(names);
        return true;
    }

    update_site_list(names);

    window.curr_name = current;
    window.curr_ip = sites[current]["os_ip"];
    window.curr_pw = sites[current]["os_pw"];

    return true
}

function site_select(names) {
    var list = $("#site-select-list");
    var newlist = "<li data-role='list-divider'>Select Site</li>";
    $.each(names,function(a,b){
        newlist += "<li><a href='javascript:update_site(\""+b+"\");'>"+b+"</a></li>"
    })

    list.html(newlist);
    if (list.hasClass("ui-listview")) list.listview("refresh");
    changePage("#site-select");
}

function update_site_list(names) {
    list = "";
    var current = localStorage.getItem("current_site");
    $.each(names,function(a,b){
        list += "<option "+(b==current ? "selected ":"")+"value='"+b+"'>"+b+"</option>";
    })

    $("#site-selector").html(list)
    try {
        $("#site-selector").selectmenu("refresh");
    } catch (err) {
    }
}

function update_site(newsite) {
    var sites = getsites();
    if (newsite in sites) {
        localStorage.setItem("current_site",newsite);
        check_configured();
    }
    newload();
}

function getsites() {
    sites = JSON.parse(localStorage.getItem("sites"));
    if (sites === null) sites = new Object();
    return sites;
}

// show error message
function showerror(msg) {
        $.mobile.loading( 'show', {
            text: msg,
            textVisible: true,
            textonly: true,
            theme: 'b'
            });
    // hide after delay
    setTimeout( function(){$.mobile.loading('hide')}, 1500);
}

function pad(number) {
    var r = String(number);
    if ( r.length === 1 ) {
        r = '0' + r;
    }
    return r;
}

if (!Date.prototype.toISOString) {
    (function() {
        Date.prototype.toISOString = function() {
            return this.getUTCFullYear()
                + '-' + pad(this.getUTCMonth() + 1)
                + '-' + pad(this.getUTCDate())
                + 'T' + pad(this.getUTCHours())
                + ':' + pad(this.getUTCMinutes())
                + ':' + pad(this.getUTCSeconds())
                + '.' + String((this.getUTCMilliseconds()/1000).toFixed(3)).slice(2,5)
                + 'Z';
        };
    }());
}

Array.prototype.getUnique = function(){
   var u = {}, a = [];
   for(var i = 0, l = this.length; i < l; ++i){
      if(u.hasOwnProperty(this[i])) {
         continue;
      }
      a.push(this[i]);
      u[this[i]] = 1;
   }
   return a;
}

//Set AJAX timeout
$.ajaxSetup({
    timeout: 3000
});

//Handle timeout
$(document).ajaxError(function(x,t,m) {
    if(t.status==401) {
        location.reload();
    }
    if(t.statusText==="timeout") {
        if (m.url.search("yahooapis.com")) {
            $("#weather-list").animate({ 
                "margin-left": "-1000px"
            },1000,function(){
                $(this).hide();
            })
        } else {
            showerror("Connection timed-out. Please try again.")
        }
    }
});

//After main page is processed, hide loading message and change to the page
$(document).one("pagecreate","#sprinklers", function(){
    //Use the user's local time for preview
    var now = new Date();
    $("#preview_date").val(now.toISOString().slice(0,10));

    //Open the main page
    $("body").pagecontainer("change","#sprinklers",{transition:"none"});

    //Indicate loading is complete
    $.mobile.loading("hide");
});

//Update the preview page on date change
$("#preview_date").change(function(){
    var id = $(".ui-page-active").attr("id");
    if (id == "preview") get_preview()
});

//Update site based on selector
$("#site-selector").change(function(){
    update_site($(this).val());
    location.reload();
});

//Bind changes to the flip switches
$("input[data-role='flipswitch']").change(function(){
    var slide = $(this);
    var type = this.name;
    var pageid = $("body").pagecontainer("getActivePage").attr("id");

    //Find out what the switch was changed to
    var changedTo = slide.is(":checked");

    //If changed to on
    if (changedTo) {
        //OpenSprinkler Operation
        if (type === "en") {
            $.get("http://"+window.curr_ip+"/cv?pw="+window.curr_pw+"&en=1");
        }
        //Manual mode, manual mode and settings page
        if (type === "mm" || type === "mmm") {
            $.get("http://"+window.curr_ip+"/cv?pw="+window.curr_pw+"&mm=1");
            //If switched to off, unhighlight all of the zones highlighted in green since all will be disabled automatically
            $("#manual a.green").removeClass("green");
            $("#mm,#mmm").prop("checked",true).flipswitch("refresh");
        }
    } else {
        if (type === "en") {
            $.get("http://"+window.curr_ip+"/cv?pw="+window.curr_pw+"&en=0");
        }
        if (type === "mm" || type === "mmm") {
            $.get("http://"+window.curr_ip+"/cv?pw="+window.curr_pw+"&mm=0");
            //If switched to off, unhighlight all of the manual zones highlighted in green since all will be disabled automatically
            $("#manual a.green").removeClass("green");
            $("#mm,#mmm").prop("checked",false).flipswitch("refresh")
        }
    }
});

function comm_error() {
    showerror("Error communicating with OpenSprinkler. Please check your password is correct.")
}

$(document).on("pageshow",function(e,data){
    var newpage = "#"+e.target.id;

    if (newpage == "#preview") {
        get_preview();
    }

    bind_links(newpage);
});

$(document).on("pagebeforeshow",function(e,data){
    var newpage = e.target.id;

    //Remove lingering tooltip from preview page
    $("#tooltip").remove();

    //Remove any status timers that may be running
    if (window.interval_id !== undefined) clearInterval(window.interval_id);
    if (window.timeout_id !== undefined) clearTimeout(window.timeout_id);

    if (newpage == "sprinklers") {
        //Reset status bar to loading while an update is done
        $("#footer-running").html("<p class='ui-icon ui-icon-loading mini-load'></p>");
        setTimeout(function(){
            update_device(check_status)
        },500);
    } else {
        var title = document.title;
        document.title = "OpenSprinkler: "+title;
    }
})

//Converts data-onclick attributes on page to vclick bound functions. This removes the 300ms lag on mobile devices (iOS/Android)
function bind_links(page) {
    var currpage = $(page);

    currpage.find("a[href='#"+currpage.attr('id')+"-settings']").unbind("vclick").on('vclick', function (e) {
        e.preventDefault(); e.stopImmediatePropagation();
        highlight(this);
        $(".ui-page-active [id$=settings]").panel("open");
    });
    currpage.find("a[data-onclick]").unbind("vclick").on('vclick', function (e) {
        e.preventDefault(); e.stopImmediatePropagation();
        var func = $(this).data("onclick");
        highlight(this);
        eval(func);
    });
}

function read_program(program) {
    var days0 = program[1],
        days1 = program[2],
        even = false,
        odd = false,
        interval = false,
        days = "",
        stations = "",
        newdata = new Object;

    newdata.en = program[0];
    newdata.start = program[3];
    newdata.end = program[4];
    newdata.interval = program[5];
    newdata.duration = program[6];

    for (var n=0; n < window.device.programs.nboards; n++) {
        var bits = program[7+n];
        for (var s=0; s < 8; s++) { 
            stations += (bits&(1<<s)) ? "1" : "0";
        }
    }
    newdata.stations = stations;

    if((days0&0x80)&&(days1>1)){
        //This is an interval program
        days=[days1,days0&0x7f];
        interval = true;
    } else {
        //This is a weekly program 
        for(var d=0;d<7;d++) {
            if (days0&(1<<d)) {
                days += "1";
            } else {
                days += "0";
            }
        }
        if((days0&0x80)&&(days1==0)) {even = true;}
        if((days0&0x80)&&(days1==1)) {odd = true;}
    }

    newdata.days = days;
    newdata.is_even = even;
    newdata.is_odd = odd;
    newdata.is_interval = interval;

    return newdata;
}

function change_status(seconds,sdelay,color,line) {
    var footer = $("#footer-running")
    if (window.interval_id !== undefined) clearInterval(window.interval_id);
    if (window.timeout_id !== undefined) clearTimeout(window.timeout_id);
    if (seconds > 1) update_timer(seconds,sdelay);
    footer.removeClass().addClass(color).html(line).slideDown();
}

function check_status() {
    if (!window.device.settings.en) {
        change_status(0,window.device.options.sdt,"red","<p id='running-text' style='text-align:center'>System Disabled</p>");
        return;
    }

    if (window.device.settings.rd) {
        change_status(0,window.device.options.sdt,"red","<p id='running-text' style='text-align:center'>Rain delay until "+(new Date(window.device.settings.rdst*1000).toUTCString().slice(0,-4))+"</p>");
        return;
    }

    if (window.device.settings.urs && window.device.settings.rs) {
        change_status(0,window.device.options.sdt,"red","<p id='running-text' style='text-align:center'>Rain detected</p>");
        return;
    }

    var open = new Object;
    $.each(window.device.status, function (i, stn) {
        if (stn) open[i] = stn;
    });

    if (window.device.settings.mas) {
        open.splice(window.device.settings.mas-1,1);
    }

    if (Object.keys(open).length >= 2) {
        var ptotal = 0;
        $.each(open,function (key, status){
            var tmp = window.device.settings.ps[key][1];
            if (tmp > ptotal) ptotal = tmp;
        });

        var sample = open[0],
            pid    = window.device.settings.ps[sample][0],
            pname  = pidname(pid),
            line   = "<img id='running-icon' width='11px' height='11px' src='img/running.png' /><p id='running-text'>";

        line += pname+" is running on "+Object.keys(open).length+" stations ";
        if (pid!=255&&pid!=99) line += "<span id='countdown' class='nobr'>("+sec2hms(ptotal)+" remaining)</span>";
        line += "</p>";
        change_status(ptotal,window.device.options.sdt,"green",line);
        return;
    }

    var match = false,
        i = 0;
    $.each(window.device.stations.snames,function (station,name){
        var info = "";
        if (window.device.settings.ps[i][0] && window.device.status[i] && window.device.settings.mas != i+1) {
            match = true
            var pid = window.device.settings.ps[i][0],
                pname = pidname(pid),
                line = "<img id='running-icon' width='11px' height='11px' src='img/running.png' /><p id='running-text'>";
            line += pname+" is running on station <span class='nobr'>"+name+"</span> ";
            if (pid!=255&&pid!=99) line += "<span id='countdown' class='nobr'>("+sec2hms(window.device.settings.ps[i][1])+" remaining)</span>";
            line += "</p>";
            change_status(window.device.settings.ps[i][1],window.device.options.sdt,"green",line);
            return false;
        }
        i++;
    });

    if (match) return;

    if (window.device.settings.mm) {
        change_status(0,window.device.options.sdt,"red","<p id='running-text' style='text-align:center'>Manual mode enabled</p>");
        return;
    }

    $("#footer-running").slideUp();
}

function pidname(pid) {
    pname = "Program "+pid;
    if(pid==255||pid==99) pname="Manual program";
    if(pid==254||pid==98) pname="Run-once program";
    return pname;
}

function update_timer(total,sdelay) {
    window.lastCheck = new Date().getTime();
    window.interval_id = setInterval(function(){
        var now = new Date().getTime();
        var diff = now - window.lastCheck;
        if (diff > 3000) {
            clearInterval(window.interval_id);
            $("#footer-running").html("<p class='ui-icon ui-icon-loading mini-load'></p>");
            update_device(check_status);
        }
        window.lastCheck = now;

        if (total <= 0) {
            clearInterval(window.interval_id);
            $("#footer-running").slideUp().html("<p class='ui-icon ui-icon-loading mini-load'></p>");
            if (window.timeout_id !== undefined) clearTimeout(window.timeout_id);
            window.timeout_id = setTimeout(function(){
                update_device(check_status);
            },(sdelay*1000));
        }
        else
            --total;
            $("#countdown").text("(" + sec2hms(total) + " remaining)");
    },1000)
}

function update_timers(sdelay) {
    if (window.interval_id !== undefined) clearInterval(window.interval_id);
    if (window.timeout_id !== undefined) clearTimeout(window.timeout_id);
    window.lastCheck = new Date().getTime();
    window.interval_id = setInterval(function(){
        var now = new Date().getTime();
        var diff = now - window.lastCheck;
        if (diff > 3000) {
            clearInterval(window.interval_id);
            get_status();
        }
        window.lastCheck = now;
        $.each(window.totals,function(a,b){
            if (b <= 0) {
                delete window.totals[a];
                if (a == "p") {
                    get_status();
                } else {
                    $("#countdown-"+a).parent("p").text("Station delay").parent("li").removeClass("green").addClass("red");
                    window.timeout_id = setTimeout(get_status,(sdelay*1000));
                }
            } else {
                if (a == "c") {
                    ++window.totals[a];
                    $("#clock-s").text(new Date(window.totals[a]*1000).toUTCString().slice(0,-4));
                } else {
                    --window.totals[a];
                    $("#countdown-"+a).text("(" + sec2hms(window.totals[a]) + " remaining)");
                }
            }
        })
    },1000)
}

function sec2hms(diff) {
    var str = "";
    var hours = parseInt( diff / 3600 ) % 24;
    var minutes = parseInt( diff / 60 ) % 60;
    var seconds = diff % 60;
    if (hours) str += pad(hours)+":";
    return str+pad(minutes)+":"+pad(seconds);
}

function highlight(button) {
    $(button).addClass("ui-btn-active").delay(150).queue(function(next){
        $(this).removeClass("ui-btn-active");
        next();
    });
}

function update_weather() {
    var $weather = $("#weather");
    $("#weather").unbind("click");
    $weather.html("<p class='ui-icon ui-icon-loading mini-load'></p>");

    $.getJSON("http://query.yahooapis.com/v1/public/yql?q=select%20item%20from%20weather.forecast%20where%20location%3D%22"+escape(window.device.settings.loc)+"%22&format=json&callback=?",function(data){
        if (data.query.results.channel.item.title == "City not found") {
            $("#weather-list").animate({ 
                "margin-left": "-1000px"
            },1000,function(){
                $(this).hide();
            })
            return;            
        }
        var now = data.query.results.channel.item.condition,
            text = now.text,
            code = now.code,
            temp = now.temp,
            date = now.date;

        var title = data.query.results.channel.item.title,
            loc = /Conditions for (.*) at \d+:\d+ [a|p]m .*/.exec(title);

        temp = temp+"&#176;F";

        $weather.html("<div title='"+text+"' class='wicon cond"+code+"'></div><span>"+temp+"</span><br><span class='location'>"+loc[1]+"</span>");
        $("#weather").bind("click",get_forecast);
        $("#weather-list").animate({ 
            "margin-left": "0"
        },1000).show()
    })
}

function gohome() {
    $("body").pagecontainer("change","#sprinklers",{reverse: true});
}

function changePage(toPage) {
    var curr = "#"+$("body").pagecontainer("getActivePage").attr("id");
    if (curr === toPage) {
        bind_links(curr);
    } else {
        $("body").pagecontainer("change",toPage);
    }
}

function changeFromPanel(func) {
    var $panel = $("#sprinklers-settings");
    $panel.one("panelclose", func);
    $panel.panel("close");
}

function show_about() {
    changePage("#about");
}

function open_popup(id) {
    var popup = $(id);

    popup.on("popupafteropen", function(){
        $(this).popup("reposition", {
            "positionTo": "window"
        });
    }).popup().enhanceWithin().popup("open");
}

function show_settings() {
    $.mobile.loading("show");

    var list = new Object
    list.start = "<li><div class='ui-field-contain'><fieldset>";

    $.each(window.device.options,function(key,data) {
        switch (key) {
            case "tz":
                var timezones = ["-12:00","-11:30","-11:00","-10:00","-09:30","-09:00","-08:30","-08:00","-07:00","-06:00","-05:00","-04:30","-04:00","-03:30","-03:00","-02:30","-02:00","+00:00","+01:00","+02:00","+03:00","+03:30","+04:00","+04:30","+05:00","+05:30","+05:45","+06:00","+06:30","+07:00","+08:00","+08:45","+09:00","+09:30","+10:00","+10:30","+11:00","+11:30","+12:00","+12:45","+13:00","+13:45","+14:00"];
                var tz = data-48;
                tz = ((tz>=0)?"+":"-")+pad((Math.abs(tz)/4>>0))+":"+((Math.abs(tz)%4)*15/10>>0)+((Math.abs(tz)%4)*15%10);
                list.tz = "<label for='o1' class='select'>Timezone</label><select data-mini='true' id='o1'>";
                $.each(timezones, function(i, timezone) {
                    list.tz += "<option "+((timezone == tz) ? "selected" : "")+" value='"+timezone+"'>"+timezone+"</option>";
                });
                list.tz += "</select>";
                return true;
            case "ntp":
                list.ntp = "<input data-mini='true' id='o2' type='checkbox' "+((data == "1") ? "checked='checked'" : "")+" /><label for='o2'>NTP Sync</label>";
                return true;
            case "hp0":
//                var http = window.device.options.hp1*256+data;
//                list.http = "<label for='o12'>HTTP Port</label><input data-mini='true' type='number' pattern='[0-9]*' id='o12' value='"+http+"' />";
                return true;
            case "ar":
                list.ar = "<input data-mini='true' id='o14' type='checkbox' "+((data == "1") ? "checked='checked'" : "")+" /><label for='o14'>Auto Reconnect</label>";
                return true;
            case "ext":
                list.ext = "<label for='o15'>Extension Boards</label><input data-highlight='true' data-mini='true' type='number' pattern='[0-9]*' data-type='range' min='0' max='5' id='o15' value='"+data+"' />";
                return true;
            case "seq":
                list.seq = "<input data-mini='true' id='o16' type='checkbox' "+((data == "1") ? "checked='checked'" : "")+" /><label for='o16'>Sequential</label>";
                return true;
            case "sdt":
                list.sdt = "<label for='o17'>Station Delay (seconds)</label><input data-highlight='true' data-mini='true' type='number' pattern='[0-9]*' data-type='range' min='0' max='240' id='o17' value='"+data+"' />";
                return true;
            case "mas":
                list.mas = "<label for='o18' class='select'>Master Station</label><select data-mini='true' id='o18'><option value='0'>None</option>";
                var i = 1;
                $.each(window.device.stations,function(i, station) {
                    list.mas += "<option "+((i == data) ? "selected" : "")+" value='"+i+"'>"+station+"</option>";
                    if (i == 8) return false;
                    i++;
                });
                return true;
            case "mton":
                list.mton = "<label for='o19'>Master On Delay</label><input data-highlight='true' data-mini='true' type='number' pattern='[0-9]*' data-type='range' min='0' max='60' id='o19' value='"+data+"' />";
                return true;
            case "mtof":
                list.mtof = "<label for='o20'>Master Off Delay</label><input data-highlight='true' data-mini='true' type='number' pattern='[0-9]*' data-type='range' min='-60' max='60' id='o20' value='"+data+"' />";
                return true;
            case "urs":
                list.urs = "<input data-mini='true' id='o21' type='checkbox' "+((data == "1") ? "checked='checked'" : "")+" /><label for='o21'>Use Rain Sensor</label>";
                return true;
            case "rso":
                list.rso = "<input data-mini='true' id='o22' type='checkbox' "+((data == "1") ? "checked='checked'" : "")+" /><label for='o22'>Normally Open (Rain Sensor)</label>";
                return true;
            case "wl":
                list.wl = "<label for='o23'>% Watering</label><input data-highlight='true' data-mini='true' type='number' pattern='[0-9]*' data-type='range' min='0' max='250' id='o23' value='"+data+"' />";
                return true;
            case "ipas":
                list.ipas = "<input data-mini='true' id='o25' type='checkbox' "+((data == "1") ? "checked='checked'" : "")+" /><label for='o25'>Ignore Password</label>";
                return true;
        }
    });
    list.loc = "</select><label for='loc'>Location</label><input data-mini='true' type='text' id='loc' value='"+window.device.settings.loc+"' />";
    list.end = "</fieldset></div></li>";

    str = list.start + list.tz + list.mas + list.loc + list.ext + list.sdt + list.mton + list.mtof + list.wl + list.ntp + list.ar + list.seq + list.urs + list.rso + list.ipas + list.end;
    var settings = $("#os-settings-list");
    settings.html(str).enhanceWithin();
    if (settings.hasClass("ui-listview")) settings.listview("refresh");
    $.mobile.loading("hide");
    changePage("#os-settings");
}

function show_stations() {

    $.mobile.loading("show");

    var list = "<li>",
        isMaster = window.device.settings.mas;
    if (isMaster) list += "<table><tr><th>Station Name</th><th>Activate Master?</th></tr>";
    $i = 0;
    $.each(window.device.stations.snames,function(i, station) {
        if (isMaster) list += "<tr><td>";
        list += "<input data-mini='true' id='edit_station_"+i+"' type='text' value='"+station+"' />";
        if (isMaster) {
            if (window.device.settings.mas == i+1) {
                list += "</td><td class='use_master'><p id='um_"+i+"' style='text-align:center'>(Master)</p></td></tr>";
            } else {
                list += "</td><td data-role='controlgroup' data-type='horizontal' class='use_master'><input id='um_"+i+"' type='checkbox' "+((window.device.stations.masop[parseInt(i/8)]&(1<<(i%8))) ? "checked='checked'" : "")+" /><label for='um_"+i+"'></label></td></tr>";
            }
        }
        i++;
    });
    if (isMaster) list += "</table>";
    list += "</li>";

    var stations = $("#os-stations-list");
    stations.html(list).enhanceWithin();
    if (stations.hasClass("ui-listview")) stations.listview("refresh");
    $.mobile.loading("hide");
    changePage("#os-stations");
}

function get_forecast() {
/*
    $.mobile.loading("show");
    $.get("",function(items){
        var list = $("#forecast_list");
        list.html(items).enhanceWithin();
        if (list.hasClass("ui-listview")) list.listview("refresh");
        $.mobile.loading("hide");
        changePage("#forecast");
    })    
*/
}

function get_status() {
    var runningTotal = new Object,
        allPnames = new Array;

    var list = "",
        tz = window.device.options.tz-48;

    tz = ((tz>=0)?"+":"-")+pad((Math.abs(tz)/4>>0))+":"+((Math.abs(tz)%4)*15/10>>0)+((Math.abs(tz)%4)*15%10);
    
    var header = "<span id='clock-s' class='nobr'>"+(new Date(window.device.settings.devt*1000).toUTCString().slice(0,-4))+"</span> GMT "+tz;

    runningTotal.c = window.device.settings.devt;

    var master = window.device.settings.mas,
        i = 0,
        ptotal = 0;

    var open = new Object;
    $.each(window.device.status, function (i, stn) {
        if (stn) open[i] = stn;
    });
    open = Object.keys(open).length;

    if (master && window.device.status[master-1]) open--;

    $.each(window.device.stations.snames,function(i, station) {
        var info = "";
        if (master == i+1) {
            station += " (Master)";
        } else if (window.device.settings.ps[i][0]) {
            var rem=window.device.settings.ps[i][1];
            if (open > 1) {
                if (rem > ptotal) ptotal = rem;
            } else {
                ptotal+=rem;
            }
            remm=rem/60>>0;
            rems=rem%60;
            var pid = window.device.settings.ps[i][0],
                pname = pidname(pid);
            if (window.device.status[i] && (pid!=255&&pid!=99)) runningTotal[i] = rem;
            allPnames[i] = pname;
            info = "<p class='rem'>"+((window.device.status[i]) ? "Running" : "Scheduled")+" "+pname;
            if (pid!=255&&pid!=99) info += " <span id='countdown-"+i+"' class='nobr'>("+(remm/10>>0)+(remm%10)+":"+(rems/10>>0)+(rems%10)+" remaining)</span>";
            info += "</p>";
        }
        if (window.device.status[i]) {
            var color = "green";
        } else {
            var color = "red";
        }
        list += "<li class='"+color+"'><p class='sname'>"+station+"</p>"+info+"</li>";
        i++;
    })

    var footer = "";
    var lrdur = window.device.settings.lrun[2];

    if (lrdur != 0) {
        var lrpid = window.device.settings.lrun[1];
        var pname= pidname(lrpid);

        footer = '<p>'+pname+' last ran station '+window.device.stations.snames[window.device.settings.lrun[0]]+' for '+(lrdur/60>>0)+'m '+(lrdur%60)+'s on '+(new Date(window.device.settings.lrun[3]*1000).toUTCString().slice(0,-4))+'</p>';
    }

    if (ptotal) {
        scheduled = allPnames.length;
        if (!open && scheduled) runningTotal.d = window.device.options["sdt"];
        if (open == 1) ptotal += (scheduled-1)*window.device.options["sdt"];
        allPnames = allPnames.getUnique();
        numProg = allPnames.length;
        allPnames = allPnames.join(" and ");
        var pinfo = allPnames+" "+((numProg > 1) ? "are" : "is")+" running ";
        pinfo += "<br><span id='countdown-p' class='nobr'>("+sec2hms(ptotal)+" remaining)</span>";
        runningTotal.p = ptotal;
        header += "<br>"+pinfo;
    }

    var status = $("#status_list");
    status.html(list);
    $("#status_header").html(header);
    $("#status_footer").html(footer);
    if (status.hasClass("ui-listview")) status.listview("refresh");
    window.totals = runningTotal;
    if (window.interval_id !== undefined) clearInterval(window.interval_id);
    if (window.timeout_id !== undefined) clearTimeout(window.timeout_id);

    changePage("#status");
    if (window.totals.d !== undefined) {
        delete window.totals.p;
        setTimeout(get_status,window.totals.d*1000);
    }
    update_timers(window.device.options["sdt"]);
}

function get_manual() {
    $.mobile.loading("show");

    var list = "<li data-role='list-divider' data-theme='a'>Sprinkler Stations</li>",
        i = 0;

    $.each(window.device.stations.snames,function(i,station) {
        list += '<li data-icon="false"><a style="text-align:center" '+((window.device.status[i]) ? 'class="green" ' : '')+'href="#" onclick="toggle(this);">'+station+'</a></li>';
        i++;
    })
    var mm = $("#mm_list");
    mm.html(list);
    if (mm.hasClass("ui-listview")) mm.listview("refresh");
    $.mobile.loading("hide");
    changePage("#manual");
}

function get_runonce() {
    var list = "<p style='text-align:center'>Value is in minutes. Zero means the station will be excluded from the run-once program.</p><div class='ui-field-contain'>",
        n = 0;
    $.each(window.device.stations.snames,function(i, station) {
        list += "<label for='zone-"+n+"'>"+station+":</label><input type='number' data-highlight='true' data-type='range' name='zone-"+n+"' min='0' max='50' id='zone-"+n+"' value='0'>";
        n++;
    })
    list += "</div><a class='ui-btn ui-corner-all ui-shadow' onclick='submit_runonce();'>Submit</a><a class='ui-btn ui-btn-b ui-corner-all ui-shadow' onclick='reset_runonce();'>Reset</a>";
    var progs = new Array();
    if (window.device.programs.pd.length) {
        $.each(window.device.programs.pd,function(i, program) {
            program = read_program(program);
            var prog = new Array,
                set_stations = program.stations.split("");
            for (var i=0;i<window.device.stations.snames.length;i++) { 
                prog.push(((typeof set_stations[i] !== undefined) && set_stations[i]) ? program.duration : 0);
            }
            progs.push(prog);
        })
    }

    window.rprogs = progs;
    var runonce = $("#runonce_list"),
        i=0;
    runonce.html(list);

    var quickPick = "<select data-mini='true' name='rprog' id='rprog'><option value='s'>Quick Programs</option>";
    var data = JSON.parse(localStorage.getItem("runonce"));
    if (data !== null) {
        runonce.find(":input[data-type='range']").each(function(a,b){
            $(b).val(data[i]/60);
            i++;
        })
        window.rprogs["l"] = data;
        quickPick += "<option value='l' selected='selected'>Last Used Program</option>";
    }
    for (i=0; i<progs.length; i++) {
        quickPick += "<option value='"+i+"'>Program "+(i+1)+"</option>";
    };
    quickPick += "</select>";
    $("#runonce_list p").after(quickPick);
    $("#rprog").change(function(){
        var prog = $(this).val();
        if (prog == "s") {
            reset_runonce()
            return;
        }
        if (window.rprogs[prog] == undefined) return;
        fill_runonce(runonce,window.rprogs[prog]);
    })

    runonce.enhanceWithin();
    changePage("#runonce");
}

function fill_runonce(list,data){
    var i=0;
    list.find(":input[data-type='range']").each(function(a,b){
        $(b).val(data[i]/60).slider("refresh");
        i++;
    })
}

function get_preview() {
    $("#timeline").html("");
    $("#timeline-navigation").hide()
    var date = $("#preview_date").val();
    if (date === "") return;
    date = date.split("-");

    process_programs(date[1],date[2],date[0]);

    var empty = true;
    if (window.preview_data == "") {
        $("#timeline").html("<p align='center'>No stations set to run on this day.</p>")
    } else {
        empty = false;
        var data = eval("["+window.preview_data.substring(0, window.preview_data.length - 1)+"]");
        var shortnames = [];
        $.each(data, function(){
            this.start = new Date(date[0],date[1]-1,date[2],0,0,this.start);
            this.end = new Date(date[0],date[1]-1,date[2],0,0,this.end);
            shortnames[this.group] = this.shortname;
        });
        var options = {
            'width':  '100%',
            'editable': false,
            'axisOnTop': true,
            'eventMargin': 10,
            'eventMarginAxis': 0,
            'min': new Date(date[0],date[1]-1,date[2],0),
            'max': new Date(date[0],date[1]-1,date[2],24),
            'selectable': true,
            'showMajorLabels': false,
            'zoomMax': 1000 * 60 * 60 * 24,
            'zoomMin': 1000 * 60 * 60,
            'groupsChangeable': false,
            'showNavigation': false
        };

        window.timeline = new links.Timeline(document.getElementById('timeline'));
        links.events.addListener(timeline, "select", function(){
            var row = undefined;
            var sel = timeline.getSelection();
            if (sel.length) {
                if (sel[0].row != undefined) {
                    row = sel[0].row;
                }
            }
            if (row === undefined) return;
            var content = $(".timeline-event-content")[row];
            var pid = parseInt($(content).html().substr(1)) - 1;
            get_programs(pid);
        });
        $(window).on("resize",timeline_redraw);
        timeline.draw(data, options);
        if ($(window).width() <= 480) {
            var currRange = timeline.getVisibleChartRange();
            if ((currRange.end.getTime() - currRange.start.getTime()) > 6000000) timeline.setVisibleChartRange(currRange.start,new Date(currRange.start.getTime()+6000000))
        }
        $("#timeline .timeline-groups-text").each(function(a,b){
            var stn = $(b);
            var name = shortnames[stn.text()];
            stn.attr("data-shortname",name);
        })
        $("#timeline-navigation").show()
    }
}

function process_programs(month,day,year) {
    window.preview_data = "";
    var newdata = new Object,
        devdateobj = new Date(window.device.settings.devt*1000),
        devday = Math.floor(window.device.settings.devt/(60*60*24)),
        devmin = (devdateobj.getUTCHours()*60)+devdateobj.getUTCMinutes(),
        simminutes = 0,
        simt = Date.UTC(year,month-1,day,0,0,0,0),
        simday = (simt/3600/24)>>0,
        match = [0,0],
        st_array = new Array(window.device.settings.nbrd*8),
        pid_array = new Array(window.device.settings.nbrd*8);
        et_array = new Array(window.device.settings.nbrd*8);

    for(var sid=0;sid<window.device.settings.nbrd;sid++) {
        st_array[sid]=0;pid_array[sid]=0;et_array[sid]=0;
    }

    do {
        busy=0;
        match_found=0;
        for(var pid=0;pid<window.device.programs.nprogs;pid++) {
          prog=window.device.programs.pd[pid];
          if(check_match(prog,simminutes,simt,simday,devday)) {
            for(sid=0;sid<window.device.settings.nbrd*8;sid++) {
              var bid=sid>>3;var s=sid%8;
              if(window.device.options.mas==(sid+1)) continue; // skip master station
              if(prog[7+bid]&(1<<s)) {
                et_array[sid]=prog[6]*window.device.options.wl/100>>0;pid_array[sid]=pid+1;
                match_found=1;
              }
            }
          }
        }
        if(match_found) {
          var acctime=simminutes*60;
          if(window.device.options.seq) {
            for(sid=0;sid<window.device.settings.nbrd*8;sid++) {
              if(et_array[sid]) {
                st_array[sid]=acctime;acctime+=et_array[sid];
                et_array[sid]=acctime;acctime+=window.device.options.sdt;
                busy=1;
              }
            }
          } else {
            for(sid=0;sid<window.device.settings.nbrd*8;sid++) {
              if(et_array[sid]) {
                st_array[sid]=simminutes*60;
                et_array[sid]=simminutes*60+et_array[sid];
                busy=1;
              }
            }
          }
        }
        if (busy) {
          var endminutes=run_sched(simminutes*60,st_array,pid_array,et_array,simt)/60>>0;
          if(window.device.options.seq&&simminutes!=endminutes) simminutes=endminutes;
          else simminutes++;
          for(sid=0;sid<window.device.settings.nbrd*8;sid++) {st_array[sid]=0;pid_array[sid]=0;et_array[sid]=0;}
        } else {
          simminutes++;
        }
    } while(simminutes<24*60);
}

function check_match(prog,simminutes,simt,simday,devday) {
    if(prog[0]==0) return 0;
    if ((prog[1]&0x80)&&(prog[2]>1)) {
        var dn=prog[2],
            drem=prog[1]&0x7f;
        if((simday%dn)!=((devday+drem)%dn)) return 0;
    } else {
        var date = new Date(simt);
        var wd=(date.getUTCDay()+6)%7;
        if((prog[1]&(1<<wd))==0) return 0;
        var dt=date.getUTCDate()
        if((prog[1]&0x80)&&(prog[2]==0)) {if((dt%2)!=0) return 0;}
        if((prog[1]&0x80)&&(prog[2]==1)) {
          if(dt==31) return 0;
          else if (dt==29 && date.getUTCMonth()==1) return 0;
          else if ((dt%2)!=1) return 0;
        }
    }
    if(simminutes<prog[3] || simminutes>prog[4]) return 0;
    if(prog[5]==0) return 0;
    if(((simminutes-prog[3])/prog[5]>>0)*prog[5] == (simminutes-prog[3])) {
        return 1;
    }
        return 0;
}

function run_sched(simseconds,st_array,pid_array,et_array,simt) {
  var endtime=simseconds;
  for(var sid=0;sid<window.device.settings.nbrd*8;sid++) {
    if(pid_array[sid]) {
      if(window.device.options.seq==1) {
        time_to_text(sid,st_array[sid],pid_array[sid],et_array[sid],simt);
        if((window.device.options.mas>0)&&(window.device.options.mas!=sid+1)&&(window.device.stations.masop[sid>>3]&(1<<(sid%8))))
            window.preview_data += "{'start': "+(st_array[sid]+window.device.options.mton)+",'end': "+(et_array[sid]+window.device.options.mtoff)+",'content':'','className':'master','shortname':'M','group':'Master'},";
        endtime=et_array[sid];
      } else {
        time_to_text(sid,simseconds,pid_array[sid],et_array[sid],simt);
        if((window.device.options.mas>0)&&(window.device.options.mas!=sid+1)&&(window.device.stations.masop[sid>>3]&(1<<(sid%8))))
          endtime=(endtime>et_array[sid])?endtime:et_array[sid];
      }
    }
  }
  if(window.device.options.seq==0&&window.device.options.mas>0) window.preview_data += "{'start': "+simseconds+",'end': "+endtime+",'content':'','className':'master','shortname':'M','group':'Master'},";
  return endtime;
}

function time_to_text(sid,start,pid,end,simt) {
    var className = "program-"+((pid+3)%4);
    if ((window.device.settings.rd!=0)&&(simt+start+(window.device.options.tz-48)*900<=window.device.settings.rdst)) className="delayed";
    window.preview_data += "{'start': "+start+",'end': "+end+",'className':'"+className+"','content':'P"+pid+"','shortname':'S"+(sid+1)+"','group':'"+window.device.stations.snames[sid]+"'},";
}

function timeline_redraw() {
    window.timeline.redraw();
}

function changeday(dir) {
    var inputBox = $("#preview_date");
    var date = inputBox.val();
    if (date === "") return;
    date = date.split("-");
    var nDate = new Date(date[0],date[1]-1,date[2]);
    nDate.setDate(nDate.getDate() + dir);
    var m = pad(nDate.getMonth()+1);
    var d = pad(nDate.getDate());
    inputBox.val(nDate.getFullYear() + "-" + m + "-" + d);
    get_preview();
}

function get_programs(pid) {
    var list = $("#programs_list");
    list.html(make_all_programs());
    if (typeof pid === "number" || typeof pid === "boolean") {
        if (pid === false) {
            $.mobile.silentScroll(0)
        } else {
            $("#programs fieldset[data-collapsed='false']").attr("data-collapsed","true");
            $("#program-"+pid).attr("data-collapsed","false")
        }
    }
    $("#programs input[name^='rad_days']").change(function(){
        var progid = $(this).attr('id').split("-")[1], type = $(this).val().split("-")[0], old;
        type = type.split("_")[1];
        if (type == "n") {
            old = "week"
        } else {
            old = "n"
        }
        $("#input_days_"+type+"-"+progid).show()
        $("#input_days_"+old+"-"+progid).hide()
    })

    $("#programs [id^='submit-']").click(function(){
        submit_program($(this).attr("id").split("-")[1]);
    })
    $("#programs [id^='s_checkall-']").click(function(){
        var id = $(this).attr("id").split("-")[1]
        $("[id^='station_'][id$='-"+id+"']").prop("checked",true).checkboxradio("refresh");
    })
    $("#programs [id^='s_uncheckall-']").click(function(){
        var id = $(this).attr("id").split("-")[1]
        $("[id^='station_'][id$='-"+id+"']").prop("checked",false).checkboxradio("refresh");
    })
    $("#programs [id^='delete-']").click(function(){
        delete_program($(this).attr("id").split("-")[1]);
    })
    $("#programs [id^='run-']").click(function(){
        var id = $(this).attr("id").split("-")[1];
        var durr = parseInt($("#duration-"+id).val());
        var stations = $("[id^='station_'][id$='-"+id+"']");
        var runonce = [];
        $.each(stations,function(a,b){
            if ($(b).is(":checked")) runonce.push(durr*60);
        });
        runonce.push(0);
        submit_runonce(runonce);
    })
    changePage("#programs");
    $("#programs").enhanceWithin();
    update_program_header();
}

function update_program_header() {
    $("#programs_list").find("[id^=program-]").each(function(a,b){
        var item = $(b)
        var id = item.attr('id').split("program-")[1]
        var en = $("#en-"+id).is(":checked")
        if (en) {
            item.find(".ui-collapsible-heading-toggle").removeClass("red")
        } else {
            item.find(".ui-collapsible-heading-toggle").addClass("red")
        }
    })
}

//Make the list of all programs
function make_all_programs() {
    if (window.device.programs.nprogs == 0) {
        return "<p style='text-align:center'>You have no programs currently added. Tap the Add button on the top right corner to get started.</p>";
    }
    var n = 0;
    var list = "<p style='text-align:center'>Click any program below to expand/edit. Be sure to save changes by hitting submit below.</p><div data-role='collapsible-set'>";
    $.each(window.device.programs.pd,function (i,program) {
        list += make_program(n,window.device.programs.nprogs,program);
        n++;
    });
    return list+"</div>";
}

//Generate a new program view
function fresh_program() {
    return make_program("new",1);
}

function make_program(n,total,program) {
    if (typeof program !== "undefined") {
        program = read_program(program)
    } else {
        program = {"en":0,"is_interval":0,"is_even":0,"is_odd":0,"duration":0,"interval":0,"start":0,"end":0};
    }
    var week = ["M","T","W","R","F","Sa","Su"],
        days;

    if (typeof program.days !== "undefined") {
        days = program.days.split("");
        for(var i=days.length;i--;) days[i] = days[i]|0;
    } else {
        days = [0,0,0,0,0,0,0];
    }
    if (typeof program.stations !== "undefined") {
        var set_stations = program.stations.split("");
        for(var i=set_stations.length;i--;) set_stations[i] = set_stations[i]|0;
    }
    var list = "<fieldset "+((!n && total == 1) ? "data-collapsed='false'" : "")+" id='program-"+n+"' "+((n === "new") ? "" : "data-role='collapsible'")+">";
    if (n !== "new") list += "<legend>Program "+(n + 1)+"</legend>";
    list += "<input data-mini='true' type='checkbox' "+((program.en || n==="new") ? "checked='checked'" : "")+" name='en-"+n+"' id='en-"+n+"'><label for='en-"+n+"'>Enabled</label>";
    list += "<fieldset data-role='controlgroup' data-type='horizontal' style='text-align: center'>";
    list += "<input data-mini='true' type='radio' name='rad_days-"+n+"' id='days_week-"+n+"' value='days_week-"+n+"' "+((program.is_interval) ? "" : "checked='checked'")+"><label for='days_week-"+n+"'>Weekly</label>";
    list += "<input data-mini='true' type='radio' name='rad_days-"+n+"' id='days_n-"+n+"' value='days_n-"+n+"' "+((program.is_interval) ? "checked='checked'" : "")+"><label for='days_n-"+n+"'>Interval</label>";
    list += "</fieldset><div id='input_days_week-"+n+"' "+((program.is_interval) ? "style='display:none'" : "")+">";

    list += "<fieldset data-role='controlgroup' data-type='horizontal' style='text-align: center'><p style='margin:0'>Restrictions</p>";
    list += "<input data-mini='true' type='radio' name='rad_rst-"+n+"' id='days_norst-"+n+"' value='days_norst-"+n+"' "+((!program.is_even && !program.is_odd) ? "checked='checked'" : "")+"><label for='days_norst-"+n+"'>None</label>";
    list += "<input data-mini='true' type='radio' name='rad_rst-"+n+"' id='days_odd-"+n+"' value='days_odd-"+n+"' "+((!program.is_even && program.is_odd) ? "checked='checked'" : "")+"><label for='days_odd-"+n+"'>Odd Days</label>";
    list += "<input data-mini='true' type='radio' name='rad_rst-"+n+"' id='days_even-"+n+"' value='days_even-"+n+"' "+((!program.is_odd && program.is_even) ? "checked='checked'" : "")+"><label for='days_even-"+n+"'>Even Days</label>";
    list += "</fieldset>";

    list += "<fieldset data-type='horizontal' data-role='controlgroup' style='text-align: center'><p style='margin:0'>Days of the Week</p>";
    var j = 0;
    $.each(week,function (i,day) {
        list += "<input data-mini='true' type='checkbox' "+((!program.is_interval && days[j]) ? "checked='checked'" : "")+" name='d"+j+"-"+n+"' id='d"+j+"-"+n+"'><label for='d"+j+"-"+n+"'>"+day+"</label>";
        j++;
    })
    list += "</fieldset></div>";

    list += "<div "+((program.is_interval) ? "" : "style='display:none'")+" id='input_days_n-"+n+"' class='ui-grid-a'>";
    list += "<div class='ui-block-a'><label for='every-"+n+"'>Interval (Days)</label><input data-mini='true' type='number' name='every-"+n+"' pattern='[0-9]*' id='every-"+n+"' value='"+days[0]+"'></div>";
    list += "<div class='ui-block-b'><label for='starting-"+n+"'>Starting In</label><input data-mini='true' type='number' name='starting-"+n+"' pattern='[0-9]*' id='starting-"+n+"' value='"+days[1]+"'></div>";
    list += "</div>";

    list += "<fieldset data-role='controlgroup'><legend>Stations:</legend>";
    j = 0;
    $.each(window.device.stations.snames,function (i,station) {
        list += "<input data-mini='true' type='checkbox' "+(((typeof set_stations !== "undefined") && set_stations[j]) ? "checked='checked'" : "")+" name='station_"+j+"-"+n+"' id='station_"+j+"-"+n+"'><label for='station_"+j+"-"+n+"'>"+station+"</label>";
        j++;
    })
    list += "</fieldset>";

    list += "<fieldset data-role='controlgroup' data-type='horizontal' style='text-align: center'>";
    list += "<input data-mini='true' type='reset' name='s_checkall-"+n+"' id='s_checkall-"+n+"' value='Check All' />";
    list += "<input data-mini='true' type='reset' name='s_uncheckall-"+n+"' id='s_uncheckall-"+n+"' value='Uncheck All' />";
    list += "</fieldset>";

    list += "<div class='ui-grid-a'>";
    list += "<div class='ui-block-a'><label for='start-"+n+"'>Start Time</label><input data-mini='true' type='time' name='start-"+n+"' id='start-"+n+"' value='"+pad(parseInt(program.start/60)%24)+":"+pad(program.start%60)+"'></div>";
    list += "<div class='ui-block-b'><label for='end-"+n+"'>End Time</label><input data-mini='true' type='time' name='end-"+n+"' id='end-"+n+"' value='"+pad(parseInt(program.end/60)%24)+":"+pad(program.end%60)+"'></div>";
    list += "</div>";

    list += "<label for='duration-"+n+"'>Duration (minutes)</label><input data-mini='true' type='number' data-highlight='true' data-type='range' name='duration-"+n+"' min='0' max='300' id='duration-"+n+"' value='"+(program.duration/60)+"'>";
    list += "<label for='interval-"+n+"'>Interval (minutes)</label><input data-mini='true' type='number' data-highlight='true' data-type='range' name='interval-"+n+"' min='0' max='1439' id='interval-"+n+"' value='"+(program.interval)+"'><br>";
    if (n === "new") {
        list += "<input data-mini='true' type='submit' name='submit-"+n+"' id='submit-"+n+"' value='Save New Program'></fieldset>";
    } else {
        list += "<input data-mini='true' type='submit' name='submit-"+n+"' id='submit-"+n+"' value='Save Changes to Program "+(n + 1)+"'>";
        list += "<input data-mini='true' type='submit' name='run-"+n+"' id='run-"+n+"' value='Run Program "+(n + 1)+"'>";
        list += "<input data-mini='true' data-theme='b' type='submit' name='delete-"+n+"' id='delete-"+n+"' value='Delete Program "+(n + 1)+"'></fieldset>";
    }
    return list;
}

function add_program() {
    var list = $("#newprogram");
    list.html(fresh_program());
    $("#addprogram input[name^='rad_days']").change(function(){
        var progid = "new", type = $(this).val().split("-")[0], old;
        type = type.split("_")[1];
        if (type == "n") {
            old = "week"
        } else {
            old = "n"
        }
        $("#input_days_"+type+"-"+progid).show()
        $("#input_days_"+old+"-"+progid).hide()
    })
    $("#addprogram [id^='s_checkall-']").click(function(){
        $("[id^='station_'][id$='-new']").prop("checked",true).checkboxradio("refresh");
    })
    $("#addprogram [id^='s_uncheckall-']").click(function(){
        $("[id^='station_'][id$='-new']").prop("checked",false).checkboxradio("refresh");
    })
    $("#addprogram [id^='submit-']").click(function(){
        submit_program("new");
    })
    changePage("#addprogram");
    $("#addprogram").enhanceWithin();
}

function delete_program(id) {
    areYouSure("Are you sure you want to delete program "+(parseInt(id)+1)+"?", "", function() {
        $.mobile.loading("show");
        $.get("http://"+window.curr_ip+"/dp?pw="+window.curr_pw+"&pid="+id,function(){
            $.mobile.loading("hide");
            update_device(function(){
                get_programs(false);
            });
        }).error(comm_error);
    })
}

function reset_runonce() {
    $("#runonce").find(":input[data-type='range']").val(0).slider("refresh")
}

function submit_program(id) {
    var program = [], days=[0,0]
    program[0] = ($("#en-"+id).is(':checked')) ? 1 : 0

    if($("#days_week-"+id).is(':checked')) {
        for(i=0;i<7;i++) {if($("#d"+i+"-"+id).is(':checked')) {days[0] |= (1<<i); }}
        if($("#days_odd-"+id).is(':checked')) {days[0]|=0x80; days[1]=1;}
        else if($("#days_even-"+id).is(':checked')) {days[0]|=0x80; days[1]=0;}
    } else if($("#days_n-"+id).is(':checked')) {
        days[1]=parseInt($("#every-"+id).val(),10);
        if(!(days[1]>=2&&days[1]<=128)) {showerror("Error: Interval days must be between 2 and 128.");return;}
        days[0]=parseInt($("#starting-"+id).val(),10);
        if(!(days[0]>=0&&days[0]<days[1])) {showerror("Error: Starting in days wrong.");return;}
        days[0]|=0x80;
    }
    program[1] = days[0]
    program[2] = days[1]

    var start = $("#start-"+id).val().split(":")
    program[3] = parseInt(start[0])*60+parseInt(start[1])
    var end = $("#end-"+id).val().split(":")
    program[4] = parseInt(end[0])*60+parseInt(end[1])

    if(!(program[3]<program[4])) {showerror("Error: Start time must be prior to end time.");return;}

    program[5] = parseInt($("#interval-"+id).val())
    program[6] = $("#duration-"+id).val() * 60

    var sel = $("[id^=station_][id$=-"+id+"]")
    var total = sel.length
    var nboards = total / 8


    var stations=[0],station_selected=0,bid, sid;
    for(bid=0;bid<nboards;bid++) {
        stations[bid]=0;
        for(s=0;s<8;s++) {
            sid=bid*8+s;
            if($("#station_"+sid+"-"+id).is(":checked")) {
                stations[bid] |= 1<<s; station_selected=1;
            }
        }
    }
    if(station_selected==0) {showerror("Error: You have not selected any stations.");return;}
    program = JSON.stringify(program.concat(stations))
    $.mobile.loading("show");
    if (id == "new") {
        $.get("http://"+window.curr_ip+"/cp?pw="+window.curr_pw+"&pid=-1&v="+program,function(){
            $.mobile.loading("hide");
            update_device(get_programs);
            showerror("Program added successfully");
        }).error(comm_error);
    } else {
        $.get("http://"+window.curr_ip+"/cp?pw="+window.curr_pw+"&pid="+id+"&v="+program,function(){
            $.mobile.loading("hide");
            update_program_header();
            showerror("Program has been updated")
        }).error(comm_error);
    }
}

function submit_settings() {
    var opt = {}, invalid = false;
    $("#os-settings-list").find(":input").each(function(a,b){
        var $item = $(b), id = $item.attr('id'), data = $item.val();
        switch (id) {
            case "o1":
                var tz = data.split(":")
                tz[0] = parseInt(tz[0],10);
                tz[1] = parseInt(tz[1],10);
                tz[1]=(tz[1]/15>>0)/4.0;tz[0]=tz[0]+(tz[0]>=0?tz[1]:-tz[1]);
                data = ((tz[0]+12)*4)>>0
                break;
            case "o2":
            case "o14":
            case "o16":
            case "o21":
            case "o22":
            case "o25":
                data = $item.is(":checked") ? 1 : 0
                if (!data) return true
                break;
        }
        opt[id] = encodeURIComponent(data)
    })
    if (invalid) return
    $.mobile.loading("show");
    $.get("http://"+window.curr_ip+"/co?pw="+window.curr_pw+"&"+$.param(opt),function(){
        $.mobile.loading("hide");
        changePage("#settings");
        showerror("Settings have been saved");
        update_device();
        update_weather();
    }).error(comm_error);
}

function submit_stations() {
    var names = {}, invalid = false,v="";bid=0,s=0,m={},masop="";
    $("#os-stations-list").find(":input,p[id^='um_']").each(function(a,b){
        var $item = $(b), id = $item.attr('id'), data = $item.val();
        switch (id) {
            case "edit_station_" + id.slice("edit_station_".length):
                id = "s" + id.split("_")[2]
                if (data.length > 16) {
                    invalid = true
                    $item.focus()
                    showerror("Station name must be 16 characters or less")
                    return false
                }
                names[id] = data
                return true;
                break;
            case "um_" + id.slice("um_".length):
                v = ($item.is(":checked") || $item.prop("tagName") == "P") ? "1".concat(v) : "0".concat(v);
                s++;
                if (parseInt(s/8) > bid) {
                    m["m"+bid]=parseInt(v,2); bid++; s=0; v="";
                }
                return true;
                break;
        }
    })
    m["m"+bid]=parseInt(v,2);
    if ($("[id^='um_']").length) masop = "&"+$.param(m);
    if (invalid) return
    $.mobile.loading("show");
    $.get("http://"+window.curr_ip+"/cs?pw="+window.curr_pw+"&"+$.param(names)+masop,function(){
        $.mobile.loading("hide");
        changePage("#settings");
        showerror("Stations have been updated");
        update_device();
    }).error(comm_error);
}

function submit_runonce(runonce) {
    if (typeof runonce === 'undefined') {
        var runonce = []
        $("#runonce").find(":input[data-type='range']").each(function(a,b){
            runonce.push(parseInt($(b).val())*60)
        })
        runonce.push(0);
    }
    localStorage.setItem("runonce",JSON.stringify(runonce));
    $.get("http://"+window.curr_ip+"/cr?pw="+window.curr_pw+"&t="+JSON.stringify(runonce),function(){
        showerror("Run-once program has been scheduled");
    }).error(comm_error);
    changePage("#sprinklers");
}

function toggle(anchor) {
    if ($("#mm").val() == "off") return;
    var $list = $("#mm_list");
    var $anchor = $(anchor);
    var $listitems = $list.children("li:not(li.ui-li-divider)");
    var $item = $anchor.closest("li:not(li.ui-li-divider)");
    var currPos = $listitems.index($item) + 1;
    var total = $listitems.length;
    if ($anchor.hasClass("green")) {
        $.get("http://"+window.curr_ip+"/sn"+currPos+"=0").error(function(){
            $anchor.addClass("green");
            comm_error()
        })
        $anchor.removeClass("green");
    } else {
        $.get("http://"+window.curr_ip+"/sn"+currPos+"=1&t=0").error(function(){
            $anchor.removeClass("green");
            comm_error()
        })
        $anchor.addClass("green");
    }
}

function raindelay() {
    $.mobile.loading("show");
    $.get("http://"+window.curr_ip+"/cv?pw="+window.curr_pw+"&rd="+$("#delay").val(),function(){
        $("#raindelay").popup("close");
        $("#footer-running").html("<p class='ui-icon ui-icon-loading mini-load'></p>");
        update_device(check_status);
        showerror("Rain delay has been successfully set");
    }).error(comm_error);
    $.mobile.loading("hide");
}

function clear_config() {
    areYouSure("Are you sure you want to delete all settings and return to the default settings (this will delete the configuration file)?", "", function() {
        localStorage.removeItem("sites");
        localStorage.removeItem("current_site");
        showerror("Configuration has been deleted. Please wait while you are redirected to the installer.");
        setTimeout(function(){location.reload()},2500);
    });    
}

function rbt() {
    areYouSure("Are you sure you want to reboot OpenSprinkler?", "", function() {
        $.mobile.loading("show");
        $.get("http://"+window.curr_ip+"/cv?pw="+window.curr_pw+"&rbt=1",function(){
            $.mobile.loading("hide");
                showerror("OpenSprinkler is rebooting now");
        }).error(comm_error);
    });
}

function rsn() {
    areYouSure("Are you sure you want to stop all stations?", "", function() {
        $.mobile.loading("show");
        $.get("http://"+window.curr_ip+"/cv?pw="+window.curr_pw+"&rsn=1",function(){
            $.mobile.loading("hide");
            update_device(check_status);
            showerror("All stations have been stopped");
        }).error(comm_error);
    });
}

function export_config(toFile) {
    var newdata = new Object;

    newdata.programs = window.device.programs.pd;
    newdata.options = new Object;
    newdata.options.loc = window.device.settings.loc;   
    $.each(window.device.options,function(opt,val){
        if (opt in window.keyNames) {
            newdata.options[window.keyNames[opt]] = {"en":"0","val":val};
        }
    })
    newdata.stations = window.device.stations.snames;
    newdata.masop = window.device.stations.masop;

    if (toFile) {
        if (!navigator.userAgent.match(/(iPad|iPhone|iPod)/g)) {
            document.location = 'data:Application/octet-stream,' + encodeURIComponent(JSON.stringify(newdata));
        } else {
            showerror("File API is not supported by your browser")
        }
        return;
    } else {
        localStorage.setItem("backup", JSON.stringify(newdata));
        showerror("Backup saved to your device");
    }
}

function import_config(data) {
    if (typeof data === "undefined") {
        var data = localStorage.getItem("backup");
        if (data === null) {
            showerror("No backup available on this device");
            return;
        }
    }
    data = JSON.parse(data);
    areYouSure("Are you sure you want to restore the configuration?", "", function() {
        $.mobile.loading("show");

        var cs = "/cs?pw="+window.curr_pw,
            co = "/co?pw="+window.curr_pw,
            cp_start = "/cp?pw="+window.curr_pw,
            i = 0;

        $.each(data.options,function (key,value) {
            if (typeof value === "object") {
                if ($.inArray(key, [2,14,16,21,22,25]) && value.val == 0) return true; 
                co += "&o"+key+"="+value.val;
            } else if (key == "loc") {
                co += "&"+key+"="+encodeURIComponent(value);
            }
        })
        $.each(data.stations,function (i,station) {
            cs += "&s"+i+"="+encodeURIComponent(station);
            i++;
        })
        $i = 0;
        $.each(data.masop,function (i,bit) {
            cs += "&m"+i+"="+encodeURIComponent(bit);
            i++;
        })
        $.when(
            $.get("http://"+window.curr_ip+co).error(comm_error),
            $.get("http://"+window.curr_ip+cs).error(comm_error),
            $.get("http://"+window.curr_ip+"/dp?pw="+window.curr_pw+"&pid=-1").error(comm_error),
            $.each(data.programs,function (i,prog) {
                $.get("http://"+window.curr_ip+cp_start+"&pid=-1&v="+((typeof prog === "object") ? JSON.stringify(prog) : prog)).error(comm_error);
            })
        ).then(function(){
            $.mobile.loading("hide");
            showerror("Backup restored to your device");
        });
    });
}

function getConfigFile() {
    if (navigator.userAgent.match(/(iPad|iPhone|iPod)/g) || !window.FileReader) {
        showerror("File API is not supported by your browser");
        return;
    }
    $('#configInput').click();
}

function handleConfig(files) {
    var config = files[0];
    var reader = new FileReader();
    reader.onload = function(e){
        try{
            var obj=JSON.parse($.trim(e.target.result));
            import_config(JSON.stringify(obj));
        }catch(e){
            showerror("Unable to read the configuration file. Please check the file and try again.");
        }
    };
    reader.readAsText(config);
}

function areYouSure(text1, text2, callback) {
    var popup = $('\
    <div data-role="popup" class="ui-content" data-overlay-theme="b" id="sure">\
        <h3 class="sure-1" style="text-align:center">'+text1+'</h3>\
        <p class="sure-2" style="text-align:center">'+text2+'</p>\
        <a class="sure-do ui-btn ui-btn-b ui-corner-all ui-shadow" href="#">Yes</a>\
        <a class="sure-dont ui-btn ui-corner-all ui-shadow" href="#">No</a>\
    </div>');

    $(".ui-page-active").append(popup);

    $("#sure").on("popupafterclose", function(){
        $(this).remove();
    }).on("popupafteropen", function(){
        $(this).popup("reposition", {
            "positionTo": "window"
        });
    }).popup().enhanceWithin().popup("open");

    //Bind buttons
    $("#sure .sure-do").on("click.sure", function() {
        $("#sure").popup("close");
        callback();
    });
    $("#sure .sure-dont").on("click.sure", function() {
        $("#sure").popup("close");
    });
}

function submit_newuser() {
    document.activeElement.blur();
    $.mobile.loading("show");

    var sites = getsites();

    //Submit form data to the server
    $.getJSON("http://"+$("#os_ip").val()+"/jc",function(data){
        $.mobile.loading("hide");
        if (data.en !== undefined) {
            var name = $("#os_name").val();
            sites[name] = window.curr_name = new Object();
            sites[name]["os_ip"] = window.curr_ip = $("#os_ip").val()
            sites[name]["os_pw"] = window.curr_pw = $("#os_pw").val()
            localStorage.setItem("sites",JSON.stringify(sites));
            localStorage.setItem("current_site",name);
            update_site_list(Object.keys(sites));
            newload();
        } else {
            showerror("Check IP/Port and try again.")
        }
    })
}

function show_sites() {
    var list = "<div data-role='collapsible-set'>";
    var sites = getsites();
    $.each(sites,function(a,b){
        list += "<fieldset id='site-"+a+"' data-role='collapsible'>";
        list += "<legend>"+a+"</legend>";
        list += "<label for='cip-"+a+"'>Change IP</label><input id='cip-"+a+"' type='text' value='"+b["os_ip"]+"' />";
        list += "<label for='cpw-"+a+"'>Change Password</label><input id='cpw-"+a+"' type='password' />";
        list += "<a data-role='button' onclick='change_site(\""+a+"\")'>Save Changes to "+a+"</a>";
        list += "<a data-role='button' onclick='delete_site(\""+a+"\")' data-theme='b'>Delete "+a+"</a>";
        list += "</fieldset>";
    })

    $("#site-control-list").html(list+"</div>").trigger("create");
    changePage("#site-control");
}

function delete_site(site) {
    var sites = getsites();
    delete sites[site];
    localStorage.setItem("sites",JSON.stringify(sites));
    update_site_list(Object.keys(sites));
    show_sites();
    if ($.isEmptyObject(sites)) {
        changePage("#start");
        $("#addnew").popup("open");
        return;
    }
    if (site === localStorage.getItem("current_site")) site_select(Object.keys(sites));
}

function change_site(site) {
    var sites = getsites();

    var ip = $("#cip-"+site).val();
    var pw = $("#cpw-"+site).val();

    if (ip != "") sites[site]["os_ip"] = ip;
    if (pw != "") sites[site]["os_pw"] = pw;

    localStorage.setItem("sites",JSON.stringify(sites));

    if (site === localStorage.getItem("current_site")) {
        check_configured();
        newload();
    }
}
