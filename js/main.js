$(window).one("load", function(){
    FastClick.attach(document.body);
});

$(document)
.ready(function() {
    //Update the language on the page using the browser's locale
    update_lang(get_locale());

    //Use the user's local time for preview
    var now = new Date();
    $("#preview_date").val(now.toISOString().slice(0,10));

    //Update site based on selector
    $("#site-selector").on("change",function(){
        update_site($(this).val());
    });
})
.ajaxError(function(x,t,m) {
    if (t.status==401 && /https?:\/\/[\d|.]+\/(?:cv|sn|cs|cr|cp|dp|co)/.exec(m.url)) {
        showerror(_("Check device password and try again."));
        return;
    } else if (t.status===0) {
        if (/https?:\/\/[\d|.]+\/(?:cv|sn|cs|cr|cp|dp|co)/.exec(m.url)) {
            // Ajax fails typically because the password is wrong
            showerror(_("Check device password and try again."));
            return;
        }
    }
    if (m.url.search("yahooapis.com") !== -1 || m.url.search("api.wunderground.com") !== -1) {
        hide_weather();
        return;
    }
    if (t.statusText==="timeout") {
        showerror(_("Connection timed-out. Please try again."));
        return;
    }
})
.one("deviceready", function() {
    try {
        //Change the status bar to match the headers
        StatusBar.overlaysWebView(false);
        StatusBar.styleLightContent();
        StatusBar.backgroundColorByHexString("#1C1C1C");
    } catch (err) {}

    checkAutoScan();
})
.one("mobileinit", function(){
    //After jQuery mobile is loaded set intial configuration
    $.mobile.defaultPageTransition = 'fade';
    $.mobile.hoverDelay = 0;
})
.one("pagebeforechange", function(event) {
    // Let the framework know we're going to handle the load
    event.preventDefault();

    //On initial load check if a valid site exists for auto connect
    var status = check_configured();

    if (status === 1) {
        newload(true);
    } else if (status === 2) {
        $.mobile.loading("hide");
        site_select();
    } else {
        changePage("#start");
    }

    $(document).on("pagebeforechange",function(e,data){
        var page = data.toPage,
            hash, showBack;

        if (typeof data.toPage !== "string") return;

        $.mobile.silentScroll(0);

        hash = $.mobile.path.parseUrl(page).hash;

        if (hash == "#programs") {
            get_programs(data.options.programToExpand);
        } else if (hash == "#addprogram") {
            add_program();
        } else if (hash =="#status") {
            get_status();
        } else if (hash == "#manual") {
            get_manual();
        } else if (hash == "#runonce") {
            get_runonce();
        } else if (hash == "#os-settings") {
            show_settings();
        } else if (hash == "#os-stations") {
            show_stations();
        } else if (hash == "#site-control") {
            showBack =  (data.options.showBack === false) ? false : true;
            $("#site-control").find(".ui-toolbar-back-btn").toggle(showBack);
            show_sites();
        } else if (hash == "#addnew") {
            show_addnew();
            return false;
        } else if (hash == "#site-select") {
            show_site_select();
            return false;
        } else if (hash == "#sprinklers") {
            if (!data.options.firstLoad) {
                //Reset status bar to loading while an update is done
                $("#footer-running").html("<p class='ui-icon ui-icon-loading mini-load'></p>");
                setTimeout(function(){
                    update_controller(check_status,function(){
                        change_status(0,0,"red","<p id='running-text' class='center'>"+_("Network Error")+"</p>");
                        hide_weather();
                    });
                },800);
            } else {
                check_status();
            }
        } else if (hash == "#settings") {
            $.each(["en","mm"],function(a,id){
                var $id = $("#"+id);
                $id.prop("checked",window.controller.settings[id]);
                if ($id.hasClass("ui-flipswitch-input")) $id.flipswitch("refresh");
                $id.on("change",flipSwitched);
            });
            $(hash).one("pagehide",function(){
                $("#en,#mm").off("change");
            });
        }
    });
})
.on("resume",function(){
    var page = $(".ui-page-active").attr("id"),
        func = function(){};

    // If current page is the start page, update main menu
    if (page == "start") {
        checkAutoScan();
        return;
    }

    // If we don't have a current device IP set, there is nothing else to update
    if (window.curr_ip === undefined) return;

    // Indicate the weather and device status are being updated
    $("#weather,#footer-running").html("<p class='ui-icon ui-icon-loading mini-load'></p>");

    if (page == "status") {
        // Update the status page
        func = get_status;
    } else if (page == "sprinklers") {
        // Update device status bar on main page
        func = check_status;
    }

    update_controller(function(){
        func();
        update_weather();
    },function(){
        change_status(0,0,"red","<p id='running-text' class='center'>"+_("Network Error")+"</p>");
        hide_weather();
    });
})
.on("pause",function(){
    //Remove any status timers that may be running
    if (window.interval_id !== undefined) clearInterval(window.interval_id);
    if (window.timeout_id !== undefined) clearTimeout(window.timeout_id);
})
.on("pageshow",function(e){
    var newpage = "#"+e.target.id,
        $newpage = $(newpage);

    fixInputClick($newpage);

    // Render graph after the page is shown otherwise graphing function will fail
    if (newpage == "#preview") {
        $("#preview_date").on("change",get_preview);
        get_preview();
        //Update the preview page on date change
        $newpage.one("pagehide",function(){
            $("#timeline").empty();
            $("#preview_date").off("change");
            $(window).off("resize");
            $("#timeline-navigation").find("a").off("click");
        });
    } else if (newpage == "#sprinklers") {
        $newpage.off("swiperight").on("swiperight", function() {
            if ($(".ui-page-active").jqmData("panel") !== "open" && !$(".ui-page-active .ui-popup-active").length) {
                open_panel();
            }
        });
    }
})
.on("pagehide","#start",removeTimers)
.on("popupbeforeposition","#localization",check_curr_lang);

//Set AJAX timeout
$.ajaxSetup({
    timeout: 6000
});

var switching = false;
function flipSwitched() {
    if (switching) return;

    //Find out what the switch was changed to
    var flip = $(this),
        id = flip.attr("id"),
        changedTo = flip.is(":checked"),
        method = (id == "mmm") ? "mm" : id,
        defer;

    if (changedTo) {
        defer = send_to_os("/cv?pw=&"+method+"=1");
    } else {
        defer = send_to_os("/cv?pw=&"+method+"=0");
    }

    $.when(defer).then(function(){
        update_controller_settings();
        if (id == "mm" || id == "mmm") $("#manual a.green").removeClass("green");
    },
    function(){
        switching = true;
        setTimeout(function(){
            switching = false;
        },200);
        flip.prop("checked",!changedTo).flipswitch("refresh");
    });
}

// Wrapper function to communicate with OpenSprinkler
function send_to_os(dest,type) {
    dest = dest.replace("pw=","pw="+window.curr_pw);
    type = type || "text";
    var obj = {
        url: window.curr_prefix+window.curr_ip+dest,
        type: "GET",
        dataType: type
    };

    if (window.curr_auth) {
        $.extend(obj,{
            beforeSend: function(xhr) { xhr.setRequestHeader("Authorization", "Basic " + btoa(window.curr_auth_user + ":" + window.curr_auth_pw)); }
        });
    }

    return $.ajax(obj);
}

// Gather new controller information and load home page
function newload(firstLoad) {
    firstLoad = firstLoad || false;
    $.mobile.loading("show");

    //Create object which will store device data
    window.controller = {};
    update_controller(
        function(){
        $.mobile.loading("hide");
            var opt = {};
            check_status();
            update_weather();
            if (firstLoad === true) {
                opt = {
                    "transition":"none",
                    "firstLoad": firstLoad
                };
            }
            if ($("body").pagecontainer("getActivePage").attr("id") != "sprinklers") changePage("#sprinklers",opt);
        },
        function(){
            $.mobile.loading("hide");
            if (Object.keys(getsites()).length) {
                changePage("#site-control",{
                    'showBack': false
                });
            } else {
                changePage("#start");
            }
        }
    );
}

// Update controller information
function update_controller(callback,fail) {
    callback = callback || function(){};
    fail = fail || function(){};

    $.when(
        update_controller_programs(),
        update_controller_stations(),
        update_controller_options(),
        update_controller_status(),
        update_controller_settings()
    ).then(callback,fail);
}

function update_controller_programs(callback) {
    callback = callback || function(){};

    if (window.curr_183 === true) {
        return send_to_os("/gp?d=0").done(function(programs){
            var vars = programs.match(/(nprogs|nboards|mnp)=[\w|\d|.\"]+/g),
                progs = /pd=\[\];(.*);/.exec(programs),
                newdata = {}, tmp, prog;

            for (var i=0; i<vars.length; i++) {
                if (vars[i] === "") continue;
                tmp = vars[i].split("=");
                newdata[tmp[0]] = parseInt(tmp[1]);
            }

            newdata.pd = [];
            if (progs !== null) {
                progs = progs[1].split(";");
                for (i=0; i<progs.length; i++) {
                    prog = progs[i].split("=");
                    prog = prog[1].replace("[", "");
                    prog = prog.replace("]", "");
                    newdata.pd[i] = parseIntArray(prog.split(","));
                }
            }

            window.controller.programs = newdata;
            callback();
        });
    } else {
        return send_to_os("/jp","json").done(function(programs){
            window.controller.programs = programs;
            callback();
        });
    }
}

function update_controller_stations(callback) {
    callback = callback || function(){};

    if (window.curr_183 === true) {
        return send_to_os("/vs").done(function(stations){
            var names = /snames=\[(.*?)\];/.exec(stations),
                masop = stations.match(/(?:masop|mo)\s?[=|:]\s?\[(.*?)\]/);

            names = names[1].split(",");
            names.pop();

            for (var i=0; i<names.length; i++) {
                names[i] = names[i].replace(/'/g,"");
            }

            masop = parseIntArray(masop[1].split(","));

            window.controller.stations = {
                "snames": names,
                "masop": masop,
                "maxlen": names.length
            };
            callback();
        });
    } else {
        return send_to_os("/jn","json").done(function(stations){
            window.controller.stations = stations;
            callback();
        });
    }
}

function update_controller_options(callback) {
    callback = callback || function(){};

    if (window.curr_183 === true) {
        return send_to_os("/vo").done(function(options){
            var isOSPi = options.match(/var sd\s*=/),
                vars = {}, tmp, i, o;

            if (isOSPi) {
                var varsRegex = /(tz|htp|htp2|nbrd|seq|sdt|mas|mton|mtoff|urs|rst|wl|ipas)\s?[=|:]\s?([\w|\d|.\"]+)/gm,
                    name;

                while ((tmp = varsRegex.exec(options)) !== null) {
                    name = tmp[1].replace("nbrd","ext").replace("mtoff","mtof");
                    vars[name] = +tmp[2];
                }
                vars.ext--;
                vars.fwv = "1.8.3-ospi";
            } else {
                var keyIndex = {1:"tz",2:"ntp",12:"hp0",13:"hp1",14:"ar",15:"ext",16:"seq",17:"sdt",18:"mas",19:"mton",20:"mtof",21:"urs",22:"rso",23:"wl",25:"ipas",26:"devid"};
                tmp = /var opts=\[(.*)\];/.exec(options);
                tmp = tmp[1].replace(/"/g,"").split(",");

                for (i=0; i<tmp.length-1; i=i+4) {
                    o = +tmp[i+3];
                    if ($.inArray(o,[1,2,12,13,14,15,16,17,18,19,20,21,22,23,25,26]) !== -1) {
                        vars[keyIndex[o]] = +tmp[i+2];
                    }
                }
                vars.fwv = 183;
            }
            window.controller.options = vars;
            callback();
        });
    } else {
        return send_to_os("/jo","json").done(function(options){
            window.controller.options = options;
            callback();
        });
    }
}

function update_controller_status(callback) {
    callback = callback || function(){};

    if (window.curr_183 === true) {
        return send_to_os("/sn0").then(
            function(status){
                var tmp = status.match(/\d+/);

                tmp = parseIntArray(tmp[0].split(""));

                window.controller.status = tmp;
                callback();
            },
            function(){
                window.controller.status = [];
            });
    } else {
        return send_to_os("/js","json").then(
            function(status){
                window.controller.status = status.sn;
                callback();
            },
            function(){
                window.controller.status = [];
            });
    }
}

function update_controller_settings(callback) {
    callback = callback || function(){};

    if (window.curr_183 === true) {
        return send_to_os("").then(
            function(settings){
                var varsRegex = /(ver|devt|nbrd|tz|en|rd|rs|mm|rdst)\s?[=|:]\s?([\w|\d|.\"]+)/gm,
                    loc = settings.match(/loc\s?[=|:]\s?[\"|'](.*)[\"|']/),
                    lrun = settings.match(/lrun=\[(.*)\]/),
                    ps = settings.match(/ps=\[(.*)\];/),
                    vars = {}, tmp, i, z;

                ps = ps[1].split("],[");
                for (i = ps.length - 1; i >= 0; i--) {
                    ps[i] = parseIntArray(ps[i].replace(/\[|\]/g,"").split(","));
                }

                while ((tmp = varsRegex.exec(settings)) !== null) {
                    vars[tmp[1]] = +tmp[2];
                }

                vars.loc = loc[1];
                vars.ps = ps;
                vars.lrun = parseIntArray(lrun[1].split(","));

                window.controller.settings = vars;
            },
            function(){
                if (window.controller.settings && window.controller.stations) {
                    var ps = [], i;
                    for (i=0; i<window.controller.stations.maxlen; i++) {
                        ps.push([0,0]);
                    }
                    window.controller.settings.ps = ps;
                }
            });
    } else {
        return send_to_os("/jc","json").then(
            function(settings){
                window.controller.settings = settings;
                callback();
            },
            function(){
                if (window.controller.settings && window.controller.stations) {
                    var ps = [], i;
                    for (i=0; i<window.controller.stations.maxlen; i++) {
                        ps.push([0,0]);
                    }
                    window.controller.settings.ps = ps;
                }
            });
    }
}

// Multisite functions
function check_configured() {
    var sites = getsites();
    var current = localStorage.getItem("current_site");

    if (sites === null) return 0;

    var names = Object.keys(sites);

    if (!names.length) return 0;

    if (current === null || !(current in sites)) return 2;

    update_site_list(names);

    window.curr_ip = sites[current].os_ip;
    window.curr_pw = sites[current].os_pw;

    if (typeof sites[current].ssl !== "undefined" && sites[current].ssl === "1") {
        window.curr_prefix = "https://";
    } else {
        window.curr_prefix = "http://";
    }

    if (typeof sites[current].auth_user !== "undefined" && typeof sites[current].auth_pw !== "undefined") {
        window.curr_auth = true;
        window.curr_auth_user = sites[current].auth_user;
        window.curr_auth_pw = sites[current].auth_pw;
    } else {
        delete window.curr_auth;
    }

    if (sites[current].is183) {
        window.curr_183 = true;
    } else {
        delete window.curr_183;
    }
    if (sites[current].is190) $.post(window.curr_prefix+window.curr_ip+"/login",{password:window.curr_pw});

    return 1;
}

// Add a new site
function submit_newuser(ssl,useAuth) {
    document.activeElement.blur();
    $.mobile.loading("show");

    var sites = getsites(),
        ip = $("#os_ip").val(),
        success = function(data){
            $.mobile.loading("hide");
            var is183, is190;

            if (typeof data === "object" && typeof data.fwv === "string" && data.fwv.match(/1\.9\.0/)) is190 = true;
            if (typeof data === "string" && data.match(/var (en|sd)\s*=/)) is183 = true;

            if (data.fwv !== undefined || is183 === true) {
                var name = $("#os_name").val(),
                    ip = $("#os_ip").val().replace(/^https?:\/\//,"");

                if (name === "") name = "Site "+(Object.keys(sites).length+1);

                sites[name] = {};
                sites[name].os_ip = window.curr_ip = ip;
                sites[name].os_pw = window.curr_pw = $("#os_pw").val();

                if (ssl) {
                    sites[name].ssl = "1";
                    window.curr_prefix = "https://";
                } else {
                    window.curr_prefix = "http://";
                }

                if (useAuth) {
                    sites[name].auth_user = $("#os_auth_user").val();
                    sites[name].auth_pw = $("#os_auth_pw").val();
                    window.curr_auth = true;
                    window.curr_auth_user = sites[current].auth_user;
                    window.curr_auth_pw = sites[current].auth_pw;
                } else {
                    delete window.curr_auth;
                }

                if (is183 === true) {
                    sites[name].is183 = "1";
                    window.curr_183 = true;
                } else if (is190 === true) {
                    sites[name].is190 = "1";
                    $.post(window.curr_prefix+window.curr_ip+"/login",{password:window.curr_pw});
                }

                $("#os_name,#os_ip,#os_pw,#os_auth_user,#os_auth_pw").val("");
                localStorage.setItem("sites",JSON.stringify(sites));
                localStorage.setItem("current_site",name);
                update_site_list(Object.keys(sites));
                newload(true);
            } else {
                showerror(_("Check IP/Port and try again."));
            }
        },
        fail = function (x){
            if (!useAuth && x.status === 401) {
                getAuth();
                return;
            }
            if (ssl) {
                $.mobile.loading("hide");
                showerror(_("Check IP/Port and try again."));
            } else {
                submit_newuser(true);
            }
        },
        getAuth = function(){
            if ($("#addnew-auth").length) {
                submit_newuser(ssl,true);
            } else {
                showAuth();
            }
        },
        showAuth = function(){
            $.mobile.loading("hide");
            var html = $('<div class="ui-content" id="addnew-auth">' +
                    '<form action="javascript:submit_newuser('+ssl+',true)" method="post" novalidate>' +
                        '<p class="center" style="font-size:smaller;margin-top:0">'+_("Authorization Required")+'</p>' +
                        '<label for="os_auth_user">'+_("Username:")+'</label>' +
                        '<input autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" type="text" name="os_auth_user" id="os_auth_user" />' +
                        '<label for="os_auth_pw">'+_("Password:")+'</label>' +
                        '<input type="password" name="os_auth_pw" id="os_auth_pw" />' +
                        '<input type="submit" value="'+_("Submit")+'" />' +
                    '</form>' +
                '</div>').enhanceWithin();

            $("#addnew-content").hide();
            $("#addnew").append(html).popup("reposition",{positionTo:"window"});
        },
        prefix;

    if (!ip) {
        showerror(_("An IP address is required to continue."));
        return;
    }

    if (useAuth !== true && $("#os_useauth").is(":checked")) {
        getAuth();
        return;
    }

    if ($("#os_usessl").is(":checked") === true) ssl = true;


    if (ssl) {
        prefix = "https://";
    } else {
        prefix = "http://";
    }

    if (useAuth) {
        prefix = prefix + $("#os_auth_user").val() + ":" + $("#os_auth_pw").val() + "@";
        $("#addnew-auth").hide();
        $("#addnew-content").show();
        $("#addnew").popup("reposition",{positionTo:"window"});
    }

    //Submit form data to the server
    $.ajax({
        url: prefix+ip+"/jo",
        type: "GET",
        dataType: "json",
        timeout: 3000,
        global: false,
        error: function(x){
            if (!useAuth && x.status === 401) {
                getAuth();
                return;
            }
            $.ajax({
                url: prefix+ip,
                type: "GET",
                dataType: "text",
                timeout: 3000,
                global: false,
                success: success,
                error: fail
            });
        },
        success: success
    });
}

// Show manage site page
function showSitesFromPanel() {
    var $panel = $("#sprinklers-settings");
    $panel.one("panelclose", function(){
        changePage("#site-control");
    });
    $panel.panel("close");
}

function show_site_select(list) {
    $("#site-select").popup("destroy").remove();

    var popup = $('<div data-role="popup" id="site-select" data-theme="a" data-overlay-theme="b">' +
            '<div data-role="header" data-theme="b">' +
                '<h1>'+_("Select Site")+'</h1>' +
            '</div>' +
            '<div class="ui-content">' +
                '<ul data-role="none" class="ui-listview ui-corner-all ui-shadow">' +
                    ((list) ? list : '') +
                '</ul>' +
            '</div>' +
        '</div>');

    popup.one("popupafterclose",function(){
        $(this).popup("destroy").remove();
    }).popup({
        history: false,
        "positionTo": "window"
    }).enhanceWithin().popup("open");
}

function show_addsite() {
    if (typeof window.deviceip === "undefined") {
        show_addnew();
    } else {
        var popup = $("#addsite");

        $("#site-add-scan").one("click",function(){
            $(".ui-popup-active").children().first().popup("close");
        });

        popup.popup("open").popup("reposition",{
            "positionTo": "#site-add"
        });
    }
}

function show_addnew(autoIP,closeOld) {
    $("#addnew").popup("destroy").remove();

    var isAuto = (autoIP) ? true : false,
        addnew = $('<div data-role="popup" id="addnew" data-theme="a">'+
            '<div data-role="header" data-theme="b">'+
                '<h1>'+_("New Device")+'</h1>' +
            '</div>' +
            '<div class="ui-content" id="addnew-content">' +
                '<form action="javascript:submit_newuser()" method="post" novalidate>' +
                    ((isAuto) ? '' : '<p class="center" style="font-size:smaller;margin-top:0">'+_("Note: The name is used to identify the OpenSprinkler within the app. OpenSprinkler IP can be either an IP or hostname. You can also specify a port by using IP:Port")+'</p>') +
                    '<label for="os_name">'+_("Open Sprinkler Name:")+'</label>' +
                    '<input autocorrect="off" spellcheck="false" type="text" name="os_name" id="os_name" placeholder="Home" />' +
                    ((isAuto) ? '' : '<label for="os_ip">'+_("Open Sprinkler IP:")+'</label>') +
                    '<input '+((isAuto) ? 'data-role="none" style="display:none" ' : '')+'autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" type="url" name="os_ip" id="os_ip" value="'+((isAuto) ? autoIP : '')+'" placeholder="home.dyndns.org" />' +
                    '<label for="os_pw">'+_("Open Sprinkler Password:")+'</label>' +
                    '<input type="password" name="os_pw" id="os_pw" value="" />' +
                    ((isAuto) ? '' : '<div data-theme="a" data-mini="true" data-role="collapsible"><h4>Advanced</h4><fieldset data-role="controlgroup" data-type="horizontal" data-mini="true" class="center">' +
                        '<input type="checkbox" name="os_useauth" id="os_useauth">' +
                        '<label for="os_useauth">'+_("Use Auth")+'</label>' +
                        '<input type="checkbox" name="os_usessl" id="os_usessl">' +
                        '<label for="os_usessl">'+_("Use SSL")+'</label>' +
                    '</fieldset></div>') +
                    '<input type="submit" data-theme="b" value="'+_("Submit")+'" />' +
                '</form>' +
            '</div>' +
        '</div>');

    addnew.one("popupafterclose",function(){
        $(this).popup("destroy").remove();
    }).popup({
        history: false,
        "positionTo": "window"
    }).enhanceWithin();

    if (closeOld === true) {
        $(".ui-popup-active").children().first().one("popupafterclose",function(){
            addnew.popup("open");
        }).popup("close");
    } else {
        addnew.popup("open");
    }

    fixInputClick(addnew);

    addnew.find(".ui-collapsible-heading-toggle").on("click",function(){
        var open = $(this).parents(".ui-collapsible").hasClass("ui-collapsible-collapsed"),
            page = $("body").pagecontainer("getActivePage"),
            height = parseInt(page.css("min-height"));

        if (open) {
            page.css("min-height",(height+65)+"px");
        } else {
            page.css("min-height",(height-65)+"px");
        }

        addnew.popup("reposition",{positionTo:"window"});
    });
}

function show_sites() {

    var list = "<div data-role='collapsible-set'>",
        sites = getsites(),
        total = Object.keys(sites).length,
        page = $("#site-control");

    $.each(sites,function(a,b){
        var c = a.replace(/ /g,"_");
        list += "<fieldset "+((total == 1) ? "data-collapsed='false'" : "")+" id='site-"+c+"' data-role='collapsible'>";
        list += "<legend>"+a+"</legend>";
        list += "<a data-role='button' href='javascript:update_site(\""+a+"\")'>"+_("Connect Now")+"</a>";
        list += "<form action='javascript:change_site(\""+c+"\");' novalidate>";
        list += "<label for='cnm-"+c+"'>"+_("Change Name")+"</label><input id='cnm-"+c+"' type='text' placeholder='"+a+"' />";
        list += "<label for='cip-"+c+"'>"+_("Change IP")+"</label><input id='cip-"+c+"' type='url' placeholder='"+b.os_ip+"' autocomplete='off' autocorrect='off' autocapitalize='off' spellcheck='false' />";
        list += "<label for='cpw-"+c+"'>"+_("Change Password")+"</label><input id='cpw-"+c+"' type='password' />";
        list += "<input type='submit' value='"+_("Save Changes to")+" "+a+"' /></form>";
        list += "<a data-role='button' href='javascript:delete_site(\""+a+"\")' data-theme='b'>"+_("Delete")+" "+a+"</a>";
        list += "</fieldset>";
    });

    page.find(".ui-content").html($(list+"</div>")).enhanceWithin();

    page.find(".ui-collapsible-set").collapsibleset();

    page.one({
        pagehide: function(){
            $(this).find(".ui-content").empty();
        }
    });
}

function delete_site(site) {
    areYouSure(_("Are you sure you want to delete")+" '"+site+"'?","",function(){
        var sites = getsites();
        delete sites[site];
        localStorage.setItem("sites",JSON.stringify(sites));
        update_site_list(Object.keys(sites));
        show_sites();
        if ($.isEmptyObject(sites)) {
            changePage("#start");
            return false;
        }
        if (site === localStorage.getItem("current_site")) $("#site-control").find(".ui-toolbar-back-btn").toggle(false);
        showerror(_("Site deleted successfully"));
        return false;
    });
}

// Modify site IP and/or password
function change_site(site) {
    var sites = getsites(),
        ip = $("#cip-"+site).val(),
        pw = $("#cpw-"+site).val(),
        nm = $("#cnm-"+site).val(),
        rename;

    site = site.replace(/_/g," ");
    rename = (nm !== "" && nm != site);

    if (ip !== "") sites[site].os_ip = ip;
    if (pw !== "") sites[site].os_pw = pw;
    if (rename) {
        sites[nm] = sites[site];
        delete sites[site];
        site = nm;
        localStorage.setItem("current_site",site);
    }

    localStorage.setItem("sites",JSON.stringify(sites));

    showerror(_("Site updated successfully"));

    if (site === localStorage.getItem("current_site")) {
        if (pw !== "") window.curr_pw = pw;
        if (ip !== "") {
            check_configured();
            newload();
        }
    }  else {
        if (rename) show_sites();
    }
}

// Display the site select popup
function site_select(names) {
    var newlist = "";

    names = names || Object.keys(getsites());

    for (var i=0; i < names.length; i++) {
        newlist += "<li><a class='ui-btn ui-btn-icon-right ui-icon-carat-r' href='javascript:update_site(\""+names[i]+"\");'>"+names[i]+"</a></li>";
    }

    show_site_select(newlist);
}

// Update the panel list of sites
function update_site_list(names) {
    var list = "",
        current = localStorage.getItem("current_site");
    $.each(names,function(a,b){
        list += "<option "+(b==current ? "selected ":"")+"value='"+b+"'>"+b+"</option>";
    });

    $("#site-selector").html(list);
    try {
        $("#site-selector").selectmenu("refresh");
    } catch (err) {
    }
}

// Change the current site
function update_site(newsite) {
    var sites = getsites();
    if (newsite in sites) {
        localStorage.setItem("current_site",newsite);
        check_configured();
    }
    newload(true);
}

// Get the list of sites from the local storage
function getsites() {
    var sites = localStorage.getItem("sites");
    sites = (sites === null) ? {} : JSON.parse(sites);
    return sites;
}

// Automatic device detection functions
function checkAutoScan() {
    try {
    // Request the device's IP address
    networkinterface.getIPAddress(function(ip){
        var chk = parseIntArray(ip.split("."));

        // Check if the IP is on a private network, if not don't enable automatic scanning
        if (!(chk[0] == 10 || (chk[0] == 172 && chk[1] > 17 && chk[1] < 32) || (chk[0] == 192 && chk[1] == 168))) {
            resetStartMenu();
            return;
        }

        //Change main menu items to reflect ability to automatically scan
        var auto = $("#auto-scan"),
            next = auto.next();

        next.removeClass("ui-first-child").find("a.ui-btn").text(_("Manually Add Device"));
        auto.show();

        window.deviceip = ip;
    });
    } catch (err) {
        resetStartMenu();
    }
}

function resetStartMenu() {
    // Change main menu to reflect manual controller entry
    var auto = $("#auto-scan"),
        next = auto.next();

    delete window.deviceip;

    next.addClass("ui-first-child").find("a.ui-btn").text(_("Add Controller"));
    auto.hide();
}

function start_scan(port,type) {
    var ip = window.deviceip.split("."),
        scanprogress = 1,
        devicesfound = 0,
        newlist = "",
        suffix = "",
        oldsites = getsites(),
        oldips = [],
        i, url, notfound, found, baseip, check_scan_status, scanning, dtype;

    type = type || 0;

    for (i in oldsites) {
        if (oldsites.hasOwnProperty(i)) {
            oldips.push(oldsites[i].os_ip);
        }
    }

    notfound = function(){
        scanprogress++;
    };

    found = function (reply) {
        scanprogress++;
        var ip = $.mobile.path.parseUrl(this.url).authority,
            fwv, tmp;

        if ($.inArray(ip,oldips) !== -1) return;

        if (this.dataType === "text") {
            tmp = reply.match(/var\s*ver=(\d+)/);
            if (!tmp) return;
            fwv = tmp[1];
        } else {
            fwv = reply.fwv;
        }

        devicesfound++;

        newlist += "<li><a class='ui-btn ui-btn-icon-right ui-icon-carat-r' href='javascript:add_found(\""+ip+"\");'>"+ip+"<p>"+_("Firmware")+": "+getOSVersion(fwv)+"</p></a></li>";
    };

    // Check if scanning is complete
    check_scan_status = function() {
        if (scanprogress == 245) {
            $.mobile.loading("hide");
            clearInterval(scanning);
            if (!devicesfound) {
                if (type === 0) {
                    start_scan(8080,1);
                } else if (type === 1) {
                    start_scan(80,2);
                } else if (type === 2) {
                    start_scan(8080,3);
                } else {
                    showerror(_("No new devices were detected on your network"));
                }
            } else {
                show_site_select(newlist);
            }
        }
    };

    ip.pop();
    baseip = ip.join(".");

    if (type === 1) {
        $.mobile.loading('show', {
                text: _("Scanning for OpenSprinkler Pi"),
                textVisible: true,
                theme: 'b'
        });
    } else if (type === 2) {
        $.mobile.loading('show', {
                text: _("Scanning for OpenSprinkler (1.8.3)"),
                textVisible: true,
                theme: 'b'
        });
    } else if (type === 3) {
        $.mobile.loading('show', {
                text: _("Scanning for OpenSprinkler Pi (1.8.3)"),
                textVisible: true,
                theme: 'b'
        });
    } else {
        $.mobile.loading('show', {
                text: _("Scanning for OpenSprinkler"),
                textVisible: true,
                theme: 'b'
        });
    }

    // Start scan
    for (i = 1; i<=244; i++) {
        ip = baseip+"."+i;
        if (type < 2) {
            suffix = "/jo";
            dtype = "json";
        } else {
            dtype = "text";
        }
        url = "http://"+ip+((port && port != 80) ? ":"+port : "")+suffix;
        $.ajax({
            url: url,
            type: "GET",
            dataType: dtype,
            timeout: 3000,
            global: false,
            error: notfound,
            success: found
        });
    }
    scanning = setInterval(check_scan_status,200);
}

// Show popup for new device after populating device IP with selected result
function add_found(ip) {
    $("#site-select").one("popupafterclose", function(){
        show_addnew(ip);
    }).popup("close");
}

// Weather functions
function show_providers() {
    $("#providers").popup("destroy").remove();

    var provider = localStorage.getItem("provider") || "yahoo",
        wapikey = localStorage.getItem("wapikey");

    var popup = $(
        '<div data-role="popup" id="providers" data-theme="a" data-dismissible="false" data-overlay-theme="b">'+
            '<a data-rel="back" class="ui-btn ui-corner-all ui-shadow ui-btn-a ui-icon-delete ui-btn-icon-notext ui-btn-right">Close</a>'+
            '<div class="ui-content">'+
                '<form>'+
                    '<label for="weather_provider">'+_("Weather Provider")+
                        '<select data-mini="true" id="weather_provider">'+
                            '<option value="yahoo">'+_("Yahoo!")+'</option>'+
                            '<option '+((provider == "wunderground") ? 'selected ' : '')+'value="wunderground">'+_("Wunderground")+'</option>'+
                        '</select>'+
                    '</label>'+
                    '<label for="wapikey">'+_("Wunderground API Key")+'<input data-mini="true" type="text" id="wapikey" value="'+((wapikey) ? wapikey : '')+'" /></label>'+
                    '<input type="submit" value="'+_("Submit")+'" />'+
                '</form>'+
            '</div>'+
        '</div>'
    );

    if (provider == "yahoo") popup.find("#wapikey").closest("label").hide();

    popup.find("form").on("submit",function(e){
        e.preventDefault();

        var wapikey = $("#wapikey").val(),
            provider = $("#weather_provider").val();

        if (provider == "wunderground" && wapikey === "") {
            showerror(_("An API key must be provided for Weather Underground"));
            return;
        }

        localStorage.setItem("wapikey",wapikey);
        localStorage.setItem("provider",provider);

        update_weather();

        $("#providers").popup("close");
    });

    //Handle provider select change on weather settings
    popup.on("change","#weather_provider",function(){
        var val = $(this).val();
        if (val === "wunderground") {
            $("#wapikey").closest("label").show();
        } else {
            $("#wapikey").closest("label").hide();
        }
        popup.popup("reposition",{
            "positionTo": "window"
        });
    });

    popup.one("popupafterclose",function(){
        document.activeElement.blur();
        this.remove();
    }).popup().enhanceWithin().popup("open");
}

function convert_temp(temp,region) {
    if (region == "United States" || region == "Bermuda" || region == "Palau") {
        temp = temp+"&#176;F";
    } else {
        temp = parseInt(Math.round((temp-32)*(5/9)))+"&#176;C";
    }
    return temp;
}

function hide_weather() {
    $("#weather-list").animate({
        "margin-left": "-1000px"
    },1000,function(){
        $(this).hide();
    });
}

function update_weather() {
    var provider = localStorage.getItem("provider"),
        wapikey = localStorage.getItem("wapikey");

    if (window.controller.settings.loc === "") {
        hide_weather();
        return;
    }

    $("#weather").off("click").html("<p class='ui-icon ui-icon-loading mini-load'></p>");

    if (provider == "wunderground" && wapikey) {
        update_wunderground_weather(wapikey);
    } else {
        update_yahoo_weather();
    }
}

function update_yahoo_weather() {
    $.getJSON("https://query.yahooapis.com/v1/public/yql?q=select%20woeid%20from%20geo.placefinder%20where%20text=%22"+escape(window.controller.settings.loc)+"%22&format=json",function(woeid){
        if (woeid.query.results === null) {
            hide_weather();
            return;
        }

        $.getJSON("https://query.yahooapis.com/v1/public/yql?q=select%20item%2Ctitle%2Clocation%20from%20weather.forecast%20where%20woeid%3D%22"+woeid.query.results.Result.woeid+"%22&format=json",function(data){
            // Hide the weather if no data is returned
            if (data.query.results.channel.item.title == "City not found") {
                hide_weather();
                return;
            }
            var now = data.query.results.channel.item.condition,
                title = data.query.results.channel.title,
                loc = /Yahoo! Weather - (.*)/.exec(title),
                region = data.query.results.channel.location.country;

            $("#weather")
                .html("<div title='"+now.text+"' class='wicon cond"+now.code+"'></div><span>"+convert_temp(now.temp,region)+"</span><br><span class='location'>"+loc[1]+"</span>")
                .on("click",show_forecast);

            $("#weather-list").animate({
                "margin-left": "0"
            },1000).show();

            update_yahoo_forecast(data.query.results.channel.item.forecast,loc[1],region,now);
        });
    });
}

function update_yahoo_forecast(data,loc,region,now) {
    var list = "<li data-role='list-divider' data-theme='a' class='center'>"+loc+"</li>",
        i;

    list += "<li data-icon='false' class='center'><div title='"+now.text+"' class='wicon cond"+now.code+"'></div><span>Now</span><br><span>"+convert_temp(now.temp,region)+"</span></li>";

    for (i=0;i < data.length; i++) {
        list += "<li data-icon='false' class='center'><span>"+data[i].date+"</span><br><div title='"+data[i].text+"' class='wicon cond"+data[i].code+"'></div><span>"+data[i].day+"</span><br><span>Low: "+convert_temp(data[i].low,region)+"  High: "+convert_temp(data[i].high,region)+"</span></li>";
    }

    var forecast = $("#forecast_list");
    forecast.html(list).enhanceWithin();
    if (forecast.hasClass("ui-listview")) forecast.listview("refresh");
}

function update_wunderground_weather(wapikey) {
    $.ajax({
        dataType: "jsonp",
        type: "GET",
        url: "https://api.wunderground.com/api/"+wapikey+"/conditions/forecast/lang:EN/q/"+escape(window.controller.settings.loc)+".json",
        success: function(data) {
            var code, temp;

            if (data.current_observation.icon_url.indexOf("nt_") !== -1) { code = "nt_"+data.current_observation.icon; }
            else code = data.current_observation.icon;

            var ww_forecast = {
                "condition": {
                    "text": data.current_observation.weather,
                    "code": code,
                    "temp_c": data.current_observation.temp_c,
                    "temp_f": data.current_observation.temp_f,
                    "date": data.current_observation.observation_time,
                    "precip_today_in": data.current_observation.precip_today_in,
                    "precip_today_metric": data.current_observation.precip_today_metric,
                    "type": "wunderground"
                },
                "location": data.current_observation.display_location.full,
                "region": data.current_observation.display_location.country_iso3166,
                simpleforecast: {}
            };

            $.each(data.forecast.simpleforecast.forecastday,function(k,attr) {
                 ww_forecast.simpleforecast[k] = attr;
            });

            if (ww_forecast.region == "US" || ww_forecast.region == "BM" || ww_forecast.region == "PW") temp = Math.round(ww_forecast.condition.temp_f)+"&#176;F";
            else temp = ww_forecast.condition.temp_c+"&#176;C";

            $("#weather")
                .html("<div title='"+ww_forecast.condition.text+"' class='wicon cond"+code+"'></div><span>"+temp+"</span><br><span class='location'>"+ww_forecast.location+"</span>")
                .on("click",show_forecast);

            $("#weather-list").animate({
                "margin-left": "0"
            },1000).show();

            update_wunderground_forecast(ww_forecast);
        }
    });
}

function update_wunderground_forecast(data) {
    var temp, precip;

    if (data.region == "US" || data.region == "BM" || data.region == "PW") {
        temp = data.condition.temp_f+"&#176;F";
        precip = data.condition.precip_today_in+" in";
    } else {
        temp = data.condition.temp_c+"&#176;C";
        precip = data.condition.precip_today_metric+" mm";
    }

    var list = "<li data-role='list-divider' data-theme='a' class='center'>"+data.location+"</li>";
    list += "<li data-icon='false' class='center'><div title='"+data.condition.text+"' class='wicon cond"+data.condition.code+"'></div><span>"+_("Now")+"</span><br><span>"+temp+"</span><br><span>"+_("Precip")+": "+precip+"</span></li>";
    $.each(data.simpleforecast, function(k,attr) {
        if (data.region == "US" || data.region == "BM" || data.region == "PW") {
            list += "<li data-icon='false' class='center'><span>"+attr.date.monthname_short+" "+attr.date.day+"</span><br><div title='"+attr.conditions+"' class='wicon cond"+attr.icon+"'></div><span>"+attr.date.weekday_short+"</span><br><span>"+_("Low")+": "+attr.low.fahrenheit+"&#176;F  "+_("High")+": "+attr.high.fahrenheit+"&#176;F</span><br><span>"+_("Precip")+": "+attr.qpf_allday.in+" in</span></li>";
        } else {
            list += "<li data-icon='false' class='center'><span>"+attr.date.monthname_short+" "+attr.date.day+"</span><br><div title='"+attr.conditions+"' class='wicon cond"+attr.icon+"'></div><span>"+attr.date.weekday_short+"</span><br><span>"+_("Low")+": "+attr.low.celsius+"&#176;C  "+_("High")+": "+attr.high.celsius+"&#176;C</span><br><span>"+_("Precip")+": "+attr.qpf_allday.mm+" mm</span></li>";
        }
    });

    var forecast = $("#forecast_list");
    forecast.html(list).enhanceWithin();
    if (forecast.hasClass("ui-listview")) forecast.listview("refresh");
}

function show_forecast() {
    changePage("#forecast");
    return false;
}

function gohome() {
    $("body").pagecontainer("change","#sprinklers",{reverse: true});
}

function open_panel() {
    var panel = $("#sprinklers-settings");
    panel.panel("option","classes.modal","needsclick ui-panel-dismiss");
    panel.panel('open');
}

function show_about() {
    changePage("#about");
}

// Device setting management functions
function show_settings() {
    var list = "",
        timezones, tz, i;

    list = "<li><div class='ui-field-contain'><fieldset>";

    if (typeof window.controller.options.tz !== "undefined") {
        timezones = ["-12:00","-11:30","-11:00","-10:00","-09:30","-09:00","-08:30","-08:00","-07:00","-06:00","-05:00","-04:30","-04:00","-03:30","-03:00","-02:30","-02:00","+00:00","+01:00","+02:00","+03:00","+03:30","+04:00","+04:30","+05:00","+05:30","+05:45","+06:00","+06:30","+07:00","+08:00","+08:45","+09:00","+09:30","+10:00","+10:30","+11:00","+11:30","+12:00","+12:45","+13:00","+13:45","+14:00"];
        tz = window.controller.options.tz-48;
        tz = ((tz>=0)?"+":"-")+pad((Math.abs(tz)/4>>0))+":"+((Math.abs(tz)%4)*15/10>>0)+((Math.abs(tz)%4)*15%10);
        list += "<label for='o1' class='select'>"+_("Timezone")+"</label><select data-mini='true' id='o1'>";
        for (i=0; i<timezones.length; i++) {
            list += "<option "+((timezones[i] == tz) ? "selected" : "")+" value='"+timezones[i]+"'>"+timezones[i]+"</option>";
        }
        list += "</select>";
    }

    if (typeof window.controller.options.mas !== "undefined") {
        list += "<label for='o18' class='select'>"+_("Master Station")+"</label><select data-mini='true' id='o18'><option value='0'>"+_("None")+"</option>";
        for (i=0; i<window.controller.stations.snames.length; i++) {
            list += "<option "+(((i+1) == window.controller.options.mas) ? "selected" : "")+" value='"+(i+1)+"'>"+window.controller.stations.snames[i]+"</option>";
            if (i == 7) break;
        }
        list += "</select>";
    }

    if (typeof window.controller.options.hp0 !== "undefined") {
        list += "<label for='o12'>"+_("HTTP Port (restart required)")+"</label><input data-mini='true' type='number' pattern='[0-9]*' id='o12' value='"+(window.controller.options.hp1*256+window.controller.options.hp0)+"' />";
    }

    if (typeof window.controller.options.devid !== "undefined") {
        list += "<label for='o26'>"+_("Device ID (restart required)")+"</label><input data-mini='true' type='number' pattern='[0-9]*' max='255' id='o26' value='"+window.controller.options.devid+"' />";
    }

    list += "<label for='loc'>"+_("Location")+"</label><input data-mini='true' type='text' id='loc' value='"+window.controller.settings.loc+"' />";

    if (typeof window.controller.options.ext !== "undefined") {
        list += "<label for='o15'>"+_("Extension Boards")+"</label><input data-highlight='true' type='number' pattern='[0-9]*' data-type='range' min='0' max='5' id='o15' value='"+window.controller.options.ext+"' />";
    }

    if (typeof window.controller.options.sdt !== "undefined") {
        list += "<label for='o17'>"+_("Station Delay (seconds)")+"</label><input data-highlight='true' type='number' pattern='[0-9]*' data-type='range' min='0' max='240' id='o17' value='"+window.controller.options.sdt+"' />";
    }

    if (typeof window.controller.options.mton !== "undefined") {
        list += "<label for='o19'>"+_("Master On Delay")+"</label><input data-highlight='true' type='number' pattern='[0-9]*' data-type='range' min='0' max='60' id='o19' value='"+window.controller.options.mton+"' />";
    }

    if (typeof window.controller.options.mtof !== "undefined") {
        list += "<label for='o20'>"+_("Master Off Delay")+"</label><input data-highlight='true' type='number' pattern='[0-9]*' data-type='range' min='-60' max='60' id='o20' value='"+window.controller.options.mtof+"' />";
    }

    if (typeof window.controller.options.wl !== "undefined") {
        list += "<label for='o23'>"+_("% Watering")+"</label><input data-highlight='true' type='number' pattern='[0-9]*' data-type='range' min='0' max='250' id='o23' value='"+window.controller.options.wl+"' />";
    }

    if (typeof window.controller.options.ntp !== "undefined") {
        list += "<label for='o2'><input data-mini='true' id='o2' type='checkbox' "+((window.controller.options.ntp === 1) ? "checked='checked'" : "")+" />"+_("NTP Sync")+"</label>";
    }

    if (typeof window.controller.options.ar !== "undefined") {
        list += "<label for='o14'><input data-mini='true' id='o14' type='checkbox' "+((window.controller.options.ar === 1) ? "checked='checked'" : "")+" />"+_("Auto Reconnect")+"</label>";
    }

    if (typeof window.controller.options.seq !== "undefined") {
        list += "<label for='o16'><input data-mini='true' id='o16' type='checkbox' "+((window.controller.options.seq === 1) ? "checked='checked'" : "")+" />"+_("Sequential")+"</label>";
    }

    if (typeof window.controller.options.urs !== "undefined") {
        list += "<label for='o21'><input data-mini='true' id='o21' type='checkbox' "+((window.controller.options.urs === 1) ? "checked='checked'" : "")+" />"+_("Use Rain Sensor")+"</label>";
    }

    if (typeof window.controller.options.rso !== "undefined") {
        list += "<label for='o22'><input data-mini='true' id='o22' type='checkbox' "+((window.controller.options.rso === 1) ? "checked='checked'" : "")+" />"+_("Normally Open (Rain Sensor)")+"</label>";
    }

    if (typeof window.controller.options.ipas !== "undefined") {
        list += "<label for='o25'><input data-mini='true' id='o25' type='checkbox' "+((window.controller.options.ipas === 1) ? "checked='checked'" : "")+" />"+_("Ignore Password")+"</label>";
    }

    list += "</fieldset></div></li>";

    $("#os-settings .ui-content").html($('<ul data-role="listview" data-inset="true" id="os-settings-list"></ul>').html(list).listview().enhanceWithin());

    $("#os-settings").one("pagehide",function(){
        $(this).find(".ui-content").empty();
    });
}

function submit_settings() {
    var opt = {},
        invalid = false,
        isPi = isOSPi(),
        keyNames = {1:"tz",2:"ntp",12:"htp",13:"htp2",14:"ar",15:"nbrd",16:"seq",17:"sdt",18:"mas",19:"mton",20:"mtoff",21:"urs",22:"rst",23:"wl",25:"ipas"},
        key;

    $("#os-settings-list").find(":input").each(function(a,b){
        var $item = $(b),
            id = $item.attr('id'),
            data = $item.val();

        switch (id) {
            case "o1":
                var tz = data.split(":");
                tz[0] = parseInt(tz[0],10);
                tz[1] = parseInt(tz[1],10);
                tz[1]=(tz[1]/15>>0)/4.0;tz[0]=tz[0]+(tz[0]>=0?tz[1]:-tz[1]);
                data = ((tz[0]+12)*4)>>0;
                break;
            case "o2":
            case "o14":
            case "o16":
            case "o21":
            case "o22":
            case "o25":
                data = $item.is(":checked") ? 1 : 0;
                if (!data) return true;
                break;
        }
        if (isPi) {
            if (id == "loc") {
                id = "oloc";
            } else {
                key = /\d+/.exec(id);
                id = "o"+keyNames[key];
            }
        }
        opt[id] = data;
    });
    if (invalid) return;
    $.mobile.loading("show");
    send_to_os("/co?pw=&"+$.param(opt)).done(function(){
        $(document).one("pageshow",function(){
            showerror(_("Settings have been saved"));
        });
        window.history.back();
        update_controller(update_weather);
    });
}

// Station managament function
function show_stations() {
    var list = "<li style='white-space:inherit'>",
        isMaster = window.controller.options.mas ? true : false,
        hasIR = (typeof window.controller.stations.ignore_rain === "object") ? true : false,
        useTableView = (hasIR || isMaster);

    if (useTableView) {
        list += "<table><tr><th class='center'>"+_("Station Name")+"</th>";
        if (isMaster) list += "<th class='center'>"+_("Activate Master?")+"</th>";
        if (hasIR) list += "<th class='center'>"+_("Ignore Rain?")+"</th>";
        list += "</tr>";
    }

    $.each(window.controller.stations.snames,function(i, station) {
        if (useTableView) list += "<tr><td>";
        list += "<input data-mini='true' id='edit_station_"+i+"' type='text' value='"+station+"' />";
        if (useTableView) {
            list += "</td>";
            if (isMaster) {
                if (window.controller.options.mas == i+1) {
                    list += "<td colspan='"+(isMaster+hasIR)+"' class='use_master'><p class='um_"+i+" ir_"+i+"' class='center'>("+_("Master")+")</p></td>";
                } else {
                    list += "<td data-role='controlgroup' data-type='horizontal' class='use_master'><label for='um_"+i+"'><input id='um_"+i+"' type='checkbox' "+((window.controller.stations.masop[parseInt(i/8)]&(1<<(i%8))) ? "checked='checked'" : "")+" /></label></td>";
                }
            }
            if (hasIR) {
                if (window.controller.options.mas != i+1) {
                    list += "<td data-role='controlgroup' data-type='horizontal' class='use_master'><label for='ir_"+i+"'><input id='ir_"+i+"' type='checkbox' "+((window.controller.stations.ignore_rain[parseInt(i/8)]&(1<<(i%8))) ? "checked='checked'" : "")+" /></label></td></tr>";
                }
            }
            list += "</tr>";
        }
        i++;
    });

    if (useTableView) list += "</table>";
    list += "</li>";

    $("#os-stations .ui-content").html($('<ul data-role="listview" data-inset="true" id="os-stations-list"></ul>').html(list).listview().enhanceWithin());

    $("#os-stations").one("pagehide",function(){
        $(this).find(".ui-content").empty();
    });
}

function submit_stations() {
    var names = {},
        invalid = false,
        v=r="",
        bid=bid2=0,
        s=s2=0,
        m={},
        i={},
        masop=ignore_rain="";

    $("#os-stations-list").find(":input,p[id^='um_'],p[id^='ir_']").each(function(a,b){
        var $item = $(b), id = $item.attr('id'), data = $item.val();
        switch (id) {
            case "edit_station_" + id.slice("edit_station_".length):
                id = "s" + id.split("_")[2];
                if (data.length > 16) {
                    invalid = true;
                    $item.focus();
                    showerror(_("Station name must be 16 characters or less"));
                    return false;
                }
                names[id] = data;
                return true;
            case "um_" + id.slice("um_".length):
                v = ($item.is(":checked") || $item.prop("tagName") == "P") ? "1".concat(v) : "0".concat(v);
                s++;
                if (parseInt(s/8) > bid) {
                    m["m"+bid]=parseInt(v,2); bid++; s=0; v="";
                }
                return true;
            case "ir_" + id.slice("ir_".length):
                r = ($item.is(":checked") || $item.prop("tagName") == "P") ? "1".concat(r) : "0".concat(r);
                s2++;
                if (parseInt(s2/8) > bid2) {
                    i["i"+bid2]=parseInt(r,2); bid2++; s2=0; r="";
                }
                return true;
        }
    });
    m["m"+bid]=parseInt(v,2);
    i["i"+bid2]=parseInt(r,2);
    if ($("[id^='um_']").length) masop = "&"+$.param(m);
    if ($("[id^='ir_']").length) ignore_rain = "&"+$.param(i);
    if (invalid) return;
    $.mobile.loading("show");
    send_to_os("/cs?pw=&"+$.param(names)+masop+ignore_rain).done(function(){
        $(document).one("pageshow",function(){
            showerror(_("Stations have been updated"));
        });
        window.history.back();
        update_controller();
    });
}

// Current status related functions
function get_status() {
    var runningTotal = {},
        allPnames = [],
        color = "",
        list = "",
        tz = window.controller.options.tz-48,
        lastCheck;

    if ($("body").pagecontainer("getActivePage").attr("id") === "status") {
        $("#status .ui-content").empty();
    }

    tz = ((tz>=0)?"+":"-")+pad((Math.abs(tz)/4>>0))+":"+((Math.abs(tz)%4)*15/10>>0)+((Math.abs(tz)%4)*15%10);

    var header = "<span id='clock-s' class='nobr'>"+dateToString(new Date(window.controller.settings.devt*1000))+"</span>"+tzToString(" ","GMT",tz);

    runningTotal.c = window.controller.settings.devt;

    var master = window.controller.options.mas,
        ptotal = 0;

    var open = {};
    $.each(window.controller.status, function (i, stn) {
        if (stn) open[i] = stn;
    });
    open = Object.keys(open).length;

    if (master && window.controller.status[master-1]) open--;

    $.each(window.controller.stations.snames,function(i, station) {
        var info = "";

        if (master == i+1) {
            station += " ("+_("Master")+")";
        } else if (window.controller.settings.ps[i][0]) {
            var rem=window.controller.settings.ps[i][1];
            if (open > 1) {
                if (rem > ptotal) ptotal = rem;
            } else {
                if (window.controller.settings.ps[i][0] !== 99 && rem !== 1) ptotal+=rem;
            }
            var pid = window.controller.settings.ps[i][0],
                pname = pidname(pid);
            if (window.controller.status[i] && (pid!=255&&pid!=99)) runningTotal[i] = rem;
            allPnames[i] = pname;
            info = "<p class='rem'>"+((window.controller.status[i]) ? _("Running") : _("Scheduled"))+" "+pname;
            if (pid!=255&&pid!=99) info += " <span id='countdown-"+i+"' class='nobr'>(" + sec2hms(rem) + " "+_("remaining")+")</span>";
            info += "</p>";
         }
        if (window.controller.status[i]) {
            color = "green";
        } else {
            color = "red";
        }
        list += "<li class='"+color+"'><p class='sname'>"+station+"</p>"+info+"</li>";
    });

    var footer = "";
    var lrdur = window.controller.settings.lrun[2];

    if (lrdur !== 0) {
        var lrpid = window.controller.settings.lrun[1];
        var pname= pidname(lrpid);

        footer = '<p>'+pname+' '+_('last ran station')+' '+window.controller.stations.snames[window.controller.settings.lrun[0]]+' '+_('for')+' '+(lrdur/60>>0)+'m '+(lrdur%60)+'s '+_('on')+' '+dateToString(new Date(window.controller.settings.lrun[3]*1000))+'</p>';
    }

    if (ptotal) {
        var scheduled = allPnames.length;
        if (!open && scheduled) runningTotal.d = window.controller.options.sdt;
        if (open == 1) ptotal += (scheduled-1)*window.controller.options.sdt;
        allPnames = getUnique($.grep(allPnames,function(n){return(n);}));
        var numProg = allPnames.length;
        allPnames = allPnames.join(" "+_("and")+" ");
        var pinfo = allPnames+" "+((numProg > 1) ? _("are") : _("is"))+" "+_("running")+" ";
        pinfo += "<br><span id='countdown-p' class='nobr'>("+sec2hms(ptotal)+" "+_("remaining")+")</span>";
        runningTotal.p = ptotal;
        header += "<br>"+pinfo;
    }

    $("#status .ui-content").append(
        $('<p id="status_header"></p>').html(header),
        $('<ul data-role="listview" data-inset="true" id="status_list"></ul>').html(list).listview(),
        $('<p id="status_footer"></p>').html(footer)
    );

    if (window.interval_id !== undefined) clearInterval(window.interval_id);
    if (window.timeout_id !== undefined) clearTimeout(window.timeout_id);

    $("#status").one("pagehide",function(){
        removeTimers();
        $(this).find(".ui-content").empty();
    });

    if (runningTotal.d !== undefined) {
        delete runningTotal.p;
        setTimeout(refresh_status,runningTotal.d*1000);
    }

    if (window.interval_id !== undefined) clearInterval(window.interval_id);
    if (window.timeout_id !== undefined) clearTimeout(window.timeout_id);

    lastCheck = new Date().getTime();
    window.interval_id = setInterval(function(){
        var now = new Date().getTime(),
            page = $(".ui-page-active").attr("id"),
            diff = now - lastCheck;

        if (diff > 3000) {
            clearInterval(window.interval_id);
            if (page == "status") refresh_status();
        }
        lastCheck = now;
        $.each(runningTotal,function(a,b){
            if (b <= 0) {
                delete runningTotal[a];
                if (a == "p") {
                    if (page == "status") {
                        refresh_status();
                    } else {
                        clearInterval(window.interval_id);
                        return;
                    }
                } else {
                    $("#countdown-"+a).parent("p").text(_("Station delay")).parent("li").removeClass("green").addClass("red");
                    window.timeout_id = setTimeout(refresh_status,window.controller.options.sdt*1000);
                }
            } else {
                if (a == "c") {
                    ++runningTotal[a];
                    $("#clock-s").text(dateToString(new Date(runningTotal[a]*1000)));
                } else {
                    --runningTotal[a];
                    $("#countdown-"+a).text("(" + sec2hms(runningTotal[a]) + " "+_("remaining")+")");
                }
            }
        });
    },1000);
}

function refresh_status() {
    $.when(
        update_controller_status(),
        update_controller_settings()
    ).then(function(){
        if ($(".ui-page-active").attr("id") == "status") {
            get_status();
        } else {
            if (window.interval_id !== undefined) clearInterval(window.interval_id);
            if (window.timeout_id !== undefined) clearInterval(window.timeout_id);
            return;
        }
    });
}

function removeTimers() {
    //Remove any status timers that may be running
    if (window.interval_id !== undefined) clearInterval(window.interval_id);
    if (window.timeout_id !== undefined) clearTimeout(window.timeout_id);
}

// Actually change the status bar
function change_status(seconds,sdelay,color,line) {
    var footer = $("#footer-running");
    if (window.interval_id !== undefined) clearInterval(window.interval_id);
    if (window.timeout_id !== undefined) clearTimeout(window.timeout_id);
    if (seconds > 1) update_timer(seconds,sdelay);
    footer.removeClass().addClass(color).html(line).slideDown();
}

// Update status bar based on device status
function check_status() {
    var open, ptotal, sample, pid, pname, line, match, tmp, i;

    if (!window.controller.settings.en) {
        change_status(0,window.controller.options.sdt,"red","<p id='running-text' class='center'>"+_("System Disabled")+"</p>");
        return;
    }

    if (window.controller.settings.rd) {
        change_status(0,window.controller.options.sdt,"red","<p id='running-text' class='center'>"+_("Rain delay until")+" "+dateToString(new Date(window.controller.settings.rdst*1000))+"</p>");
        return;
    }

    if (window.controller.settings.urs && window.controller.settings.rs) {
        change_status(0,window.controller.options.sdt,"red","<p id='running-text' class='center'>"+_("Rain detected")+"</p>");
        return;
    }

    // Handle open stations
    open = {};
    for (i=0; i<window.controller.status.length; i++) {
        if (window.controller.status[i]) open[i] = window.controller.status[i];
    }

    if (window.controller.options.mas) delete open[window.controller.options.mas-1];

    // Handle more than 1 open station
    if (Object.keys(open).length >= 2) {
        ptotal = 0;

        for (i in open) {
            if (open.hasOwnProperty(i)) {
                tmp = window.controller.settings.ps[i][1];
                if (tmp > ptotal) ptotal = tmp;
            }
        }

        sample = Object.keys(open)[0];
        pid    = window.controller.settings.ps[sample][0];
        pname  = pidname(pid);
        line   = "<div id='running-icon'></div><p id='running-text'>";

        line += pname+" "+_("is running on")+" "+Object.keys(open).length+" "+_("stations")+" ";
        if (pid!=255&&pid!=99) line += "<span id='countdown' class='nobr'>("+sec2hms(ptotal)+" "+_("remaining")+")</span>";
        line += "</p>";
        change_status(ptotal,window.controller.options.sdt,"green",line);
        return;
    }

    // Handle a single station open
    match = false;
    for (i=0; i<window.controller.stations.snames.length; i++) {
        if (window.controller.settings.ps[i][0] && window.controller.status[i] && window.controller.options.mas != i+1) {
            match = true;
            pid = window.controller.settings.ps[i][0];
            pname = pidname(pid);
            line = "<div id='running-icon'></div><p id='running-text'>";
            line += pname+" "+_("is running on station")+" <span class='nobr'>"+window.controller.stations.snames[i]+"</span> ";
            if (pid!=255&&pid!=99) line += "<span id='countdown' class='nobr'>("+sec2hms(window.controller.settings.ps[i][1])+" "+_("remaining")+")</span>";
            line += "</p>";
            change_status(window.controller.settings.ps[i][1],window.controller.options.sdt,"green",line);
            return false;
        }
    }

    if (match) return;

    if (window.controller.settings.mm) {
        change_status(0,window.controller.options.sdt,"red","<p id='running-text' class='center'>"+_("Manual mode enabled")+"</p>");
        return;
    }

    $("#footer-running").slideUp();
}

// Handle timer update on the home page for the status bar
function update_timer(total,sdelay) {
    if (window.interval_id !== undefined) clearInterval(window.interval_id);
    if (window.timeout_id !== undefined) clearTimeout(window.timeout_id);
    window.lastCheck = new Date().getTime();
    window.interval_id = setInterval(function(){
        var now = new Date().getTime();
        var diff = now - window.lastCheck;
        if (diff > 3000) {
            clearInterval(window.interval_id);
            $("#footer-running").html("<p class='ui-icon ui-icon-loading mini-load'></p>");
            update_controller(check_status);
        }
        window.lastCheck = now;

        if (total <= 0) {
            clearInterval(window.interval_id);
            $("#footer-running").slideUp().html("<p class='ui-icon ui-icon-loading mini-load'></p>");
            if (window.timeout_id !== undefined) clearTimeout(window.timeout_id);
            window.timeout_id = setTimeout(function(){
                update_controller(check_status);
            },(sdelay*1000));
        }
        else
            --total;
            $("#countdown").text("(" + sec2hms(total) + " "+_("remaining")+")");
    },1000);
}

// Manual control functions
function get_manual() {
    var list = "<li data-role='list-divider' data-theme='a'>"+_("Sprinkler Stations")+"</li>",
        page = $("#manual");

    $.each(window.controller.stations.snames,function (i,station) {
        list += '<li data-icon="false"><a class="mm_station center'+((window.controller.status[i]) ? ' green' : '')+'">'+station+'</a></li>';
    });

    page.find(".ui-content").append(
        '<p class="center">'+_('With manual mode turned on, tap a station to toggle it.')+'</p>',
        $('<ul data-role="listview" data-inset="true">'+
                '<li class="ui-field-contain">'+
                    '<label for="mmm"><b>'+_('Manual Mode')+'</b></label>'+
                    '<input type="checkbox" data-on-text="On" data-off-text="Off" data-role="flipswitch" name="mmm" id="mmm"'+(window.controller.settings.mm ? ' checked' : '')+'>'+
                '</li>'+
            '</ul>').listview(),
        $('<ul data-role="listview" data-inset="true" id="mm_list"></ul>').html(list).listview()
    );

    page.find("#mm_list").find(".mm_station").on("click",toggle);

    page.find("#mmm").flipswitch().on("change",flipSwitched);

    page.one("pagehide",function(){
        page.find(".ui-content").empty();
    });
}

function toggle() {
    if (!window.controller.settings.mm) {
        showerror(_("Manual mode is not enabled. Please enable manual mode then try again."));
        return false;
    }

    var anchor = $(this),
        list = $("#mm_list"),
        listitems = list.children("li:not(li.ui-li-divider)"),
        item = anchor.closest("li:not(li.ui-li-divider)"),
        currPos = listitems.index(item) + 1;

    if (anchor.hasClass("green")) {
        send_to_os("/sn"+currPos+"=0").then(
            function(){
                update_controller_status();
            },
            function(){
                anchor.addClass("green");
            }
        );
        anchor.removeClass("green");
    } else {
        send_to_os("/sn"+currPos+"=1&t=0").then(
            function(){
                update_controller_status();
            },
            function(){
                anchor.removeClass("green");
            }
        );
        anchor.addClass("green");
    }
    return false;
}

// Runonce functions
function get_runonce() {
    var list = "<p class='center'>"+_("Value is in minutes. Zero means the station will be excluded from the run-once program.")+"</p>",
        runonce = $("#runonce_list"),
        i=0, n=0,
        quickPick, data, progs, rprogs, z, program;

    progs = [];
    if (window.controller.programs.pd.length) {
        for (z=0; z < window.controller.programs.pd.length; z++) {
            program = read_program(window.controller.programs.pd[z]);
            var prog = [],
                set_stations = program.stations.split("");

            for (i=0;i<window.controller.stations.snames.length;i++) {
                prog.push((parseInt(set_stations[i])) ? program.duration : 0);
            }
            progs.push(prog);
        }
    }
    rprogs = progs;


    quickPick = "<select data-mini='true' name='rprog' id='rprog'><option value='s' selected='selected'>"+_("Quick Programs")+"</option>";
    data = localStorage.getItem("runonce");
    if (data !== null) {
        data = JSON.parse(data);
        runonce.find(":input[data-type='range']").each(function(a,b){
            $(b).val(data[i]/60);
            i++;
        });
        rprogs.l = data;
        quickPick += "<option value='l' >"+_("Last Used Program")+"</option>";
    }
    for (i=0; i<progs.length; i++) {
        quickPick += "<option value='"+i+"'>"+_("Program")+" "+(i+1)+"</option>";
    }
    quickPick += "</select>";
    list += quickPick+"<form>";
    $.each(window.controller.stations.snames,function(i, station) {
        list += "<div class='ui-field-contain'><label for='zone-"+n+"'>"+station+":</label><input type='range' data-highlight='true' name='zone-"+n+"' min='0' max='240' id='zone-"+n+"' value='0'></div>";
        n++;
    });

    list += "</form><a class='ui-btn ui-corner-all ui-shadow' href='javascript:submit_runonce();'>"+_("Submit")+"</a><a class='ui-btn ui-btn-b ui-corner-all ui-shadow' href='javascript:reset_runonce();'>"+_("Reset")+"</a>";

    runonce.html(list);
    $("#rprog").on("change",function(){
        var prog = $(this).val();
        if (prog == "s") {
            reset_runonce();
            return;
        }
        if (typeof rprogs[prog] === "undefined") return;
        fill_runonce(runonce,rprogs[prog]);
    });

    runonce.enhanceWithin();

    $("#runonce").one("pagehide",function(){
        $(this).find(".ui-content").empty();
    });
}

function reset_runonce() {
    $("#runonce").find(":input[data-type='range']").val(0).slider("refresh");
    return false;
}

function fill_runonce(list,data){
    var i=0;
    list.find(":input[data-type='range']").each(function(a,b){
        $(b).val(data[i]/60).slider("refresh");
        i++;
    });
}

function submit_runonce(runonce) {
    if (typeof runonce === 'undefined') {
        runonce = [];
        $("#runonce").find(":input[data-type='range']").each(function(a,b){
            runonce.push(parseInt($(b).val())*60);
        });
        runonce.push(0);
    }
    localStorage.setItem("runonce",JSON.stringify(runonce));
    send_to_os("/cr?pw=&t="+JSON.stringify(runonce)).done(function(){
        update_controller_status();
        update_controller_settings();
        showerror(_("Run-once program has been scheduled"));
    });
    gohome();
    return false;
}

// Preview functions
function get_preview() {
    var date = $("#preview_date").val(),
        $timeline = $("#timeline"),
        preview_data, process_programs, check_match, run_sched, time_to_text;

    if (date === "") return;
    date = date.split("-");

    $.mobile.loading("show");
    $("#timeline-navigation").hide();

    process_programs = function (month,day,year) {
        preview_data = [];
        var devday = Math.floor(window.controller.settings.devt/(60*60*24)),
            simminutes = 0,
            simt = Date.UTC(year,month-1,day,0,0,0,0),
            simday = (simt/3600/24)>>0,
            st_array = new Array(window.controller.settings.nbrd*8),
            pid_array = new Array(window.controller.settings.nbrd*8),
            et_array = new Array(window.controller.settings.nbrd*8),
            busy, match_found, prog;

        for(var sid=0;sid<window.controller.settings.nbrd;sid++) {
            st_array[sid]=0;pid_array[sid]=0;et_array[sid]=0;
        }

        do {
            busy=0;
            match_found=0;
            for(var pid=0;pid<window.controller.programs.pd.length;pid++) {
              prog=window.controller.programs.pd[pid];
              if(check_match(prog,simminutes,simt,simday,devday)) {
                for(sid=0;sid<window.controller.settings.nbrd*8;sid++) {
                  var bid=sid>>3;var s=sid%8;
                  if(window.controller.options.mas==(sid+1)) continue; // skip master station
                  if(prog[7+bid]&(1<<s)) {
                    et_array[sid]=prog[6]*window.controller.options.wl/100>>0;pid_array[sid]=pid+1;
                    match_found=1;
                  }
                }
              }
            }
            if(match_found) {
              var acctime=simminutes*60;
              if(window.controller.options.seq) {
                for(sid=0;sid<window.controller.settings.nbrd*8;sid++) {
                  if(et_array[sid]) {
                    st_array[sid]=acctime;acctime+=et_array[sid];
                    et_array[sid]=acctime;acctime+=window.controller.options.sdt;
                    busy=1;
                  }
                }
              } else {
                for(sid=0;sid<window.controller.settings.nbrd*8;sid++) {
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
              if(window.controller.options.seq&&simminutes!=endminutes) simminutes=endminutes;
              else simminutes++;
              for(sid=0;sid<window.controller.settings.nbrd*8;sid++) {st_array[sid]=0;pid_array[sid]=0;et_array[sid]=0;}
            } else {
              simminutes++;
            }
        } while(simminutes<24*60);
    };

    check_match = function (prog,simminutes,simt,simday,devday) {
        if(prog[0]===0) return 0;
        if ((prog[1]&0x80)&&(prog[2]>1)) {
            var dn=prog[2],
                drem=prog[1]&0x7f;
            if((simday%dn)!=((devday+drem)%dn)) return 0;
        } else {
            var date = new Date(simt);
            var wd=(date.getUTCDay()+6)%7;
            if((prog[1]&(1<<wd))===0) return 0;
            var dt=date.getUTCDate();
            if((prog[1]&0x80)&&(prog[2]===0)) {if((dt%2)!==0) return 0;}
            if((prog[1]&0x80)&&(prog[2]==1)) {
              if(dt==31) return 0;
              else if (dt==29 && date.getUTCMonth()==1) return 0;
              else if ((dt%2)!=1) return 0;
            }
        }
        if(simminutes<prog[3] || simminutes>prog[4]) return 0;
        if(prog[5]===0) return 0;
        if(((simminutes-prog[3])/prog[5]>>0)*prog[5] == (simminutes-prog[3])) {
            return 1;
        }
            return 0;
    };

    run_sched = function (simseconds,st_array,pid_array,et_array,simt) {
        var endtime=simseconds;
        for(var sid=0;sid<window.controller.settings.nbrd*8;sid++) {
            if(pid_array[sid]) {
                if(window.controller.options.seq==1) {
                    time_to_text(sid,st_array[sid],pid_array[sid],et_array[sid],simt);
                    if((window.controller.options.mas>0)&&(window.controller.options.mas!=sid+1)&&(window.controller.stations.masop[sid>>3]&(1<<(sid%8))))
                    preview_data.push({
                        'start': (st_array[sid]+window.controller.options.mton),
                        'end': (et_array[sid]+window.controller.options.mtof),
                        'content':'',
                        'className':'master',
                        'shortname':'M',
                        'group':'Master'
                    });
                    endtime=et_array[sid];
                } else {
                    time_to_text(sid,simseconds,pid_array[sid],et_array[sid],simt);
                    if((window.controller.options.mas>0)&&(window.controller.options.mas!=sid+1)&&(window.controller.stations.masop[sid>>3]&(1<<(sid%8))))
                    endtime=(endtime>et_array[sid])?endtime:et_array[sid];
                }
            }
        }
        if(window.controller.options.seq===0&&window.controller.options.mas>0) preview_data.push({
            'start': simseconds,
            'end': endtime,
            'content':'',
            'className':'master',
            'shortname':'M',
            'group':'Master'
        });
        return endtime;
    };

    time_to_text = function (sid,start,pid,end,simt) {
        var className = "program-"+((pid+3)%4);

        if ((window.controller.settings.rd!==0)&&(simt+start+(window.controller.options.tz-48)*900<=window.controller.settings.rdst)) className="delayed";
        preview_data.push({
            'start': start,
            'end': end,
            'className':className,
            'content':'P'+pid,
            'shortname':'S'+(sid+1),
            'group': window.controller.stations.snames[sid]
        });
    };

    process_programs(date[1],date[2],date[0]);

    var empty = true;
    if (!preview_data.length) {
        $timeline.html("<p align='center'>"+_("No stations set to run on this day.")+"</p>");
    } else {
        empty = false;
        var shortnames = [];
        $.each(preview_data, function(){
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

        var timeline = new links.Timeline(document.getElementById('timeline'));
        links.events.addListener(timeline, "select", function(){
            var row,
                sel = timeline.getSelection();

            if (sel.length) {
                if (typeof sel[0].row !== "undefined") {
                    row = sel[0].row;
                }
            }
            if (row === undefined) return;
            var content = $(".timeline-event-content")[row];
            var pid = parseInt($(content).html().substr(1)) - 1;
            changePage("#programs",{
                'programToExpand': pid
            });
        });
        $(window).on("resize",function(){
            timeline.redraw();
        });
        timeline.draw(preview_data, options);
        if ($(window).width() <= 480) {
            var currRange = timeline.getVisibleChartRange();
            if ((currRange.end.getTime() - currRange.start.getTime()) > 6000000) timeline.setVisibleChartRange(currRange.start,new Date(currRange.start.getTime()+6000000));
        }
        $timeline.find(".timeline-groups-text").each(function(a,b){
            var stn = $(b);
            var name = shortnames[stn.text()];
            stn.attr("data-shortname",name);
        });
        if (navigator.userAgent.indexOf('Android') > 0) {
            var navi = $("#timeline-navigation");
            navi.find(".ui-icon-plus").off("click").on("click",function(){
                timeline.zoom(0.4);
                return false;
            });
            navi.find(".ui-icon-minus").off("click").on("click",function(){
                timeline.zoom(-0.4);
                return false;
            });
            navi.find(".ui-icon-carat-l").off("click").on("click",function(){
                timeline.move(-0.2);
                return false;
            });
            navi.find(".ui-icon-carat-r").off("click").on("click",function(){
                timeline.move(0.2);
                return false;
            });
            navi.show();
        }
    }
    $.mobile.loading("hide");
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

// Program management functions
function get_programs(pid) {
    var programs = $("#programs"),
        list = programs.find(".ui-content");

    list.html($(make_all_programs())).enhanceWithin();

    programs.find(".ui-collapsible-set").collapsibleset().on({
        collapsiblecollapse: function(){
            $(this).find(".ui-collapsible-content").empty();
        },
        collapsibleexpand: function(){
            expandProgram($(this));
        }
    },".ui-collapsible");

    update_program_header();

    if (typeof pid !== "number" && window.controller.programs.pd.length === 1) pid = 0;

    if (typeof pid === "number") {
        programs.find("fieldset[data-collapsed='false']").collapsible("collapse");
        $("#program-"+pid).collapsible("expand");
    }

    programs.one("pagehide",function(){
        $(this).find(".ui-content").empty();
    });
}

function expandProgram(program) {
    var id = parseInt(program.attr("id").split("-")[1]),
        html = $(make_program(id));

    program.find(".ui-collapsible-content").html(html).enhanceWithin();

    program.find("input[name^='rad_days']").on("change",function(){
        var progid = $(this).attr('id').split("-")[1], type = $(this).val().split("-")[0], old;
        type = type.split("_")[1];
        if (type == "n") {
            old = "week";
        } else {
            old = "n";
        }
        $("#input_days_"+type+"-"+progid).show();
        $("#input_days_"+old+"-"+progid).hide();
    });

    program.find("[id^='submit-']").on("click",function(){
        submit_program($(this).attr("id").split("-")[1]);
        return false;
    });

    program.find("[id^='s_checkall-']").on("click",function(){
        var id = $(this).attr("id").split("-")[1];
        program.find("[id^='station_'][id$='-"+id+"']").prop("checked",true).checkboxradio("refresh");
        return false;
    });

    program.find("[id^='s_uncheckall-']").on("click",function(){
        var id = $(this).attr("id").split("-")[1];
        program.find("[id^='station_'][id$='-"+id+"']").prop("checked",false).checkboxradio("refresh");
        return false;
    });

    program.find("[id^='delete-']").on("click",function(){
        delete_program($(this).attr("id").split("-")[1]);
        return false;
    });

    program.find("[id^='run-']").on("click",function(){
        var id = $(this).attr("id").split("-")[1],
            durr = parseInt($("#duration-"+id).val()),
            stations = $("[id^='station_'][id$='-"+id+"']"),
            runonce = [];

        $.each(stations,function(a,b){
            if ($(b).is(":checked")) {
                runonce.push(durr*60);
            } else {
                runonce.push(0);
            }
        });
        runonce.push(0);
        submit_runonce(runonce);
        return false;
    });

    fixInputClick(program);
}

// Translate program array into easier to use data
function read_program(program) {
    var days0 = program[1],
        days1 = program[2],
        even = false,
        odd = false,
        interval = false,
        days = "",
        stations = "",
        newdata = {};

    newdata.en = program[0];
    newdata.start = program[3];
    newdata.end = program[4];
    newdata.interval = program[5];
    newdata.duration = program[6];

    for (var n=0; n < window.controller.programs.nboards; n++) {
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
        if((days0&0x80)&&(days1===0)) {even = true;}
        if((days0&0x80)&&(days1==1)) {odd = true;}
    }

    newdata.days = days;
    newdata.is_even = even;
    newdata.is_odd = odd;
    newdata.is_interval = interval;

    return newdata;
}

// Translate program ID to it's name
function pidname(pid) {
    var pname = "Program "+pid;
    if(pid==255||pid==99) pname=_("Manual program");
    if(pid==254||pid==98) pname=_("Run-once program");
    return pname;
}

// Check each program and change the background color to red if disabled
function update_program_header() {
    $("#programs_list").find("[id^=program-]").each(function(a,b){
        var item = $(b),
            heading = item.find(".ui-collapsible-heading-toggle"),
            en = window.controller.programs.pd[a][0];

        if (en) {
            heading.removeClass("red");
        } else {
            heading.addClass("red");
        }
    });
}

//Make the list of all programs
function make_all_programs() {
    if (window.controller.programs.pd.length === 0) {
        return "<p class='center'>"+_("You have no programs currently added. Tap the Add button on the top right corner to get started.")+"</p>";
    }
    var list = "<p class='center'>"+_("Click any program below to expand/edit. Be sure to save changes by hitting submit below.")+"</p><div data-role='collapsible-set'>";
    for (var i = 0; i < window.controller.programs.pd.length; i++) {
        list += "<fieldset id='program-"+i+"' data-role='collapsible'><legend>"+_("Program")+" "+(i+1)+"</legend>";
        list += "</fieldset>";
    }
    return list+"</div>";
}

//Generate a new program view
function fresh_program() {
    var list = "<fieldset id='program-new'>";
    list +=make_program("new");
    list += "</fieldset>";

    return list;
}

function make_program(n) {
    var week = [_("M"),_("T"),_("W"),_("R"),_("F"),_("Sa"),_("Su")],
        list = "",
        days, i, j, set_stations, program;

    if (n === "new") {
        program = {"en":0,"is_interval":0,"is_even":0,"is_odd":0,"duration":0,"interval":0,"start":0,"end":0,"days":[0,0]};
    } else {
        program = read_program(window.controller.programs.pd[n]);
    }

    if (typeof program.days === "string") {
        days = program.days.split("");
        for(i=days.length;i--;) days[i] = days[i]|0;
    } else {
        days = [0,0,0,0,0,0,0];
    }
    if (typeof program.stations !== "undefined") {
        set_stations = program.stations.split("");
        for(i=set_stations.length;i--;) set_stations[i] = set_stations[i]|0;
    }
    list += "<label for='en-"+n+"'><input data-mini='true' type='checkbox' "+((program.en || n==="new") ? "checked='checked'" : "")+" name='en-"+n+"' id='en-"+n+"'>"+_("Enabled")+"</label>";
    list += "<fieldset data-role='controlgroup' data-type='horizontal' class='center'>";
    list += "<input data-mini='true' type='radio' name='rad_days-"+n+"' id='days_week-"+n+"' value='days_week-"+n+"' "+((program.is_interval) ? "" : "checked='checked'")+"><label for='days_week-"+n+"'>"+_("Weekly")+"</label>";
    list += "<input data-mini='true' type='radio' name='rad_days-"+n+"' id='days_n-"+n+"' value='days_n-"+n+"' "+((program.is_interval) ? "checked='checked'" : "")+"><label for='days_n-"+n+"'>"+_("Interval")+"</label>";
    list += "</fieldset><div id='input_days_week-"+n+"' "+((program.is_interval) ? "style='display:none'" : "")+">";

    list += "<fieldset data-role='controlgroup' data-type='horizontal' class='center'><p style='margin:0'>"+_("Restrictions")+"</p>";
    list += "<input data-mini='true' type='radio' name='rad_rst-"+n+"' id='days_norst-"+n+"' value='days_norst-"+n+"' "+((!program.is_even && !program.is_odd) ? "checked='checked'" : "")+"><label for='days_norst-"+n+"'>"+_("None")+"</label>";
    list += "<input data-mini='true' type='radio' name='rad_rst-"+n+"' id='days_odd-"+n+"' value='days_odd-"+n+"' "+((!program.is_even && program.is_odd) ? "checked='checked'" : "")+"><label for='days_odd-"+n+"'>"+_("Odd Days")+"</label>";
    list += "<input data-mini='true' type='radio' name='rad_rst-"+n+"' id='days_even-"+n+"' value='days_even-"+n+"' "+((!program.is_odd && program.is_even) ? "checked='checked'" : "")+"><label for='days_even-"+n+"'>"+_("Even Days")+"</label>";
    list += "</fieldset>";

    list += "<fieldset data-type='horizontal' data-role='controlgroup' class='center'><p style='margin:0'>"+_("Days of the Week")+"</p>";
    for (j=0; j<week.length; j++) {
        list += "<label for='d"+j+"-"+n+"'><input data-mini='true' type='checkbox' "+((!program.is_interval && days[j]) ? "checked='checked'" : "")+" name='d"+j+"-"+n+"' id='d"+j+"-"+n+"'>"+week[j]+"</label>";
    }
    list += "</fieldset></div>";

    list += "<div "+((program.is_interval) ? "" : "style='display:none'")+" id='input_days_n-"+n+"' class='ui-grid-a'>";
    list += "<div class='ui-block-a'><label for='every-"+n+"'>"+_("Interval (Days)")+"</label><input data-mini='true' type='number' name='every-"+n+"' pattern='[0-9]*' id='every-"+n+"' value='"+program.days[0]+"'></div>";
    list += "<div class='ui-block-b'><label for='starting-"+n+"'>"+_("Starting In")+"</label><input data-mini='true' type='number' name='starting-"+n+"' pattern='[0-9]*' id='starting-"+n+"' value='"+program.days[1]+"'></div>";
    list += "</div>";

    list += "<fieldset data-role='controlgroup'><legend>"+_("Stations:")+"</legend>";
    for (j=0; j<window.controller.stations.snames.length; j++) {
        list += "<label for='station_"+j+"-"+n+"'><input data-mini='true' type='checkbox' "+(((typeof set_stations !== "undefined") && set_stations[j]) ? "checked='checked'" : "")+" name='station_"+j+"-"+n+"' id='station_"+j+"-"+n+"'>"+window.controller.stations.snames[j]+"</label>";
    }
    list += "</fieldset>";

    list += "<fieldset data-role='controlgroup' data-type='horizontal' class='center'>";
    list += "<a class='ui-btn ui-mini' name='s_checkall-"+n+"' id='s_checkall-"+n+"'>"+_("Check All")+"</a>";
    list += "<a class='ui-btn ui-mini' name='s_uncheckall-"+n+"' id='s_uncheckall-"+n+"'>"+_("Uncheck All")+"</a>";
    list += "</fieldset>";

    list += "<div class='ui-grid-a'>";
    list += "<div class='ui-block-a'><label for='start-"+n+"'>"+_("Start Time")+"</label><input data-mini='true' type='time' name='start-"+n+"' id='start-"+n+"' value='"+pad(parseInt(program.start/60)%24)+":"+pad(program.start%60)+"'></div>";
    list += "<div class='ui-block-b'><label for='end-"+n+"'>"+_("End Time")+"</label><input data-mini='true' type='time' name='end-"+n+"' id='end-"+n+"' value='"+pad(parseInt(program.end/60)%24)+":"+pad(program.end%60)+"'></div>";
    list += "</div>";

    list += "<label for='duration-"+n+"'>"+_("Duration (minutes)")+"</label><input type='number' data-highlight='true' data-type='range' name='duration-"+n+"' min='0' max='300' id='duration-"+n+"' value='"+(program.duration/60)+"'>";
    list += "<label for='interval-"+n+"'>"+_("Interval (minutes)")+"</label><input type='number' data-highlight='true' data-type='range' name='interval-"+n+"' min='0' max='1439' id='interval-"+n+"' value='"+(program.interval)+"'><br>";
    if (n === "new") {
        list += "<input data-mini='true' type='submit' name='submit-"+n+"' id='submit-"+n+"' value='"+_("Save New Program")+"'>";
    } else {
        list += "<input data-mini='true' type='submit' name='submit-"+n+"' id='submit-"+n+"' value='"+_("Save Changes to Program")+" "+(n + 1)+"'>";
        list += "<input data-mini='true' type='submit' name='run-"+n+"' id='run-"+n+"' value='"+_("Run Program")+" "+(n + 1)+"'>";
        list += "<input data-mini='true' data-theme='b' type='submit' name='delete-"+n+"' id='delete-"+n+"' value='"+_("Delete Program")+" "+(n + 1)+"'>";
    }
    return list;
}

function add_program() {
    var addprogram = $("#addprogram"),
        list = addprogram.find(".ui-content");

    list.html($(fresh_program())).enhanceWithin();

    addprogram.find("input[name^='rad_days']").on("change",function(){
        var progid = "new", type = $(this).val().split("-")[0], old;
        type = type.split("_")[1];
        if (type == "n") {
            old = "week";
        } else {
            old = "n";
        }
        $("#input_days_"+type+"-"+progid).show();
        $("#input_days_"+old+"-"+progid).hide();
    });

    addprogram.find("[id^='s_checkall-']").on("click",function(){
        addprogram.find("[id^='station_'][id$='-new']").prop("checked",true).checkboxradio("refresh");
        return false;
    });

    addprogram.find("[id^='s_uncheckall-']").on("click",function(){
        addprogram.find("[id^='station_'][id$='-new']").prop("checked",false).checkboxradio("refresh");
        return false;
    });

    addprogram.find("[id^='submit-']").on("click",function(){
        submit_program("new");
        return false;
    });

    addprogram.one({
        pagehide: function() {
            $(this).find(".ui-content").empty();
        }
    });
}

function delete_program(id) {
    areYouSure(_("Are you sure you want to delete program")+" "+(parseInt(id)+1)+"?", "", function() {
        $.mobile.loading("show");
        send_to_os("/dp?pw=&pid="+id).done(function(){
            $.mobile.loading("hide");
            update_controller_programs(function(){
                get_programs(false);
            });
        });
    });
}

function submit_program(id) {
    var program = [],
        days=[0,0],
        i, s;

    program[0] = ($("#en-"+id).is(':checked')) ? 1 : 0;

    if($("#days_week-"+id).is(':checked')) {
        for(i=0;i<7;i++) {if($("#d"+i+"-"+id).is(':checked')) {days[0] |= (1<<i); }}
        if($("#days_odd-"+id).is(':checked')) {days[0]|=0x80; days[1]=1;}
        else if($("#days_even-"+id).is(':checked')) {days[0]|=0x80; days[1]=0;}
    } else if($("#days_n-"+id).is(':checked')) {
        days[1]=parseInt($("#every-"+id).val(),10);
        if(!(days[1]>=2&&days[1]<=128)) {showerror(_("Error: Interval days must be between 2 and 128."));return;}
        days[0]=parseInt($("#starting-"+id).val(),10);
        if(!(days[0]>=0&&days[0]<days[1])) {showerror(_("Error: Starting in days wrong."));return;}
        days[0]|=0x80;
    }
    program[1] = days[0];
    program[2] = days[1];

    var start = $("#start-"+id).val().split(":");
    program[3] = parseInt(start[0])*60+parseInt(start[1]);
    var end = $("#end-"+id).val().split(":");
    program[4] = parseInt(end[0])*60+parseInt(end[1]);

    if(program[3]>program[4]) {showerror(_("Error: Start time must be prior to end time."));return;}

    program[5] = parseInt($("#interval-"+id).val());
    program[6] = $("#duration-"+id).val() * 60;

    var sel = $("[id^=station_][id$=-"+id+"]"),
        total = sel.length,
        nboards = total / 8;


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
    if(station_selected===0) {showerror(_("Error: You have not selected any stations."));return;}
    program = JSON.stringify(program.concat(stations));
    $.mobile.loading("show");
    if (id == "new") {
        send_to_os("/cp?pw=&pid=-1&v="+program).done(function(){
            $.mobile.loading("hide");
            update_controller_programs(function(){
                $(document).one("pageshow",function(){
                    showerror(_("Program added successfully"));
                });
                window.history.back();
            });
        });
    } else {
        send_to_os("/cp?pw=&pid="+id+"&v="+program).done(function(){
            $.mobile.loading("hide");
            update_controller_programs(function(){
                update_program_header();
            });
            showerror(_("Program has been updated"));
        });
    }
}

function raindelay() {
    $.mobile.loading("show");
    send_to_os("/cv?pw=&rd="+$("#delay").val()).done(function(){
        $.mobile.loading("hide");
        $("#raindelay").popup("close");
        $("#footer-running").html("<p class='ui-icon ui-icon-loading mini-load'></p>");
        $.when(
            update_controller_settings(),
            update_controller_status()
        ).then(check_status);
        showerror(_("Rain delay has been successfully set"));
    });
}

function rbt() {
    areYouSure(_("Are you sure you want to reboot OpenSprinkler?"), "", function() {
        $.mobile.loading("show");
        send_to_os("/cv?pw=&rbt=1").done(function(){
            $.mobile.loading("hide");
            showerror(_("OpenSprinkler is rebooting now"));
        });
    });
}

function rsn() {
    areYouSure(_("Are you sure you want to stop all stations?"), "", function() {
        $.mobile.loading("show");
        send_to_os("/cv?pw=&rsn=1").done(function(){
            $.mobile.loading("hide");
            $.when(
                update_controller_settings(),
                update_controller_status()
            ).then(check_status);
            showerror(_("All stations have been stopped"));
        });
    });
}

function clear_config() {
    areYouSure(_("Are you sure you want to delete all settings and return to the default settings?"), "", function() {
        localStorage.removeItem("sites");
        localStorage.removeItem("current_site");
        localStorage.removeItem("lang");
        localStorage.removeItem("provider");
        localStorage.removeItem("wapikey");
        localStorage.removeItem("runonce");
        update_lang(get_locale());
        changePage("#start");
    });
}

// Export and Import functions
function export_config() {
    localStorage.setItem("backup", JSON.stringify(window.controller));
    showerror(_("Backup saved on this device"));
}

function import_config(data) {
    var piNames = {1:"tz",2:"ntp",12:"htp",13:"htp2",14:"ar",15:"nbrd",16:"seq",17:"sdt",18:"mas",19:"mton",20:"mtoff",21:"urs",22:"rst",23:"wl",25:"ipas"},
        keyIndex = {"tz":1,"ntp":2,"hp0":12,"hp1":13,"ar":14,"ext":15,"seq":16,"sdt":17,"mas":18,"mton":19,"mtof":20,"urs":21,"rso":22,"wl":23,"ipas":25,"devid":26};

    if (typeof data === "undefined") {
        data = localStorage.getItem("backup");
        if (data === null) {
            showerror(_("No backup available on this device"));
            return;
        }
    }

    data = JSON.parse(data);

    if (!data.settings) {
        showerror(_("No backup available on this device"));
        return;
    }

    areYouSure(_("Are you sure you want to restore the configuration?"), "", function() {
        $.mobile.loading("show");

        var cs = "/cs?pw=",
            co = "/co?pw=",
            cp_start = "/cp?pw=",
            isPi = isOSPi(),
            i, key;

        for (i in data.options) {
            if (data.options.hasOwnProperty(i) && keyIndex.hasOwnProperty(i)) {
                key = keyIndex[i];
                if ($.inArray(key, [2,14,16,21,22,25]) !== -1 && data.options[i] === 0) continue;
                if (isPi) {
                    key = piNames[key];
                    if (key === undefined) continue;
                } else {
                    key = key;
                }
                co += "&o"+key+"="+data.options[i];
            }
        }
        co += "&"+(isPi?"o":"")+"loc="+data.settings.loc;

        for (i=0; i<data.stations.snames.length; i++) {
            cs += "&s"+i+"="+data.stations.snames[i];
        }

        for (i=0; i<data.stations.masop.length; i++) {
            cs += "&m"+i+"="+data.stations.masop[i];
        }

        if (typeof data.stations.ignore_rain === "object") {
            for (i=0; i<data.stations.ignore_rain.length; i++) {
                cs += "&i"+i+"="+data.stations.ignore_rain[i];
            }
        }

        $.when(
            send_to_os(co),
            send_to_os(cs),
            $.each(data.programs.pd,function (i,prog) {
                send_to_os(cp_start+"&pid=-1&v="+JSON.stringify(prog));
            })
        ).then(
            function(){
                update_controller(function(){
                    $.mobile.loading("hide");
                    showerror(_("Backup restored to your device"));
                    update_weather();
                });
            },
            function(){
                $.mobile.loading("hide");
                showerror(_("Unable to import configuration. Check device password and try again."));
            }
        );
    });
}

// OSPi functions
function isOSPi() {
    if (window.controller && typeof window.controller.options.fwv == "string" && window.controller.options.fwv.search(/ospi/i) !== -1) return true;
    return false;
}

function getOSVersion(fwv) {
    if (typeof fwv == "string" && fwv.search(/ospi/i) !== -1) {
        return fwv;
    } else {
        return (fwv/100>>0)+"."+((fwv/10>>0)%10)+"."+(fwv%10);
    }
}

// Accessory functions for jQuery Mobile
function areYouSure(text1, text2, callback) {
    var popup = $(
        '<div data-role="popup" class="ui-content" data-overlay-theme="b" id="sure">'+
            '<h3 class="sure-1 center">'+text1+'</h3>'+
            '<p class="sure-2 center">'+text2+'</p>'+
            '<a class="sure-do ui-btn ui-btn-b ui-corner-all ui-shadow" href="#">'+_("Yes")+'</a>'+
            '<a class="sure-dont ui-btn ui-corner-all ui-shadow" href="#">'+_("No")+'</a>'+
        '</div>'
    );

    $(".ui-page-active").append(popup);

    $("#sure").one("popupafterclose", function(){
        $(this).remove();
    }).one("popupafteropen", function(){
        $(this).popup("reposition", {
            "positionTo": "window"
        });
    }).popup({history: false}).enhanceWithin().popup("open");

    //Bind buttons
    $("#sure .sure-do").one("click.sure", function() {
        $("#sure").popup("close");
        callback();
        return false;
    });
    $("#sure .sure-dont").one("click.sure", function() {
        $("#sure").popup("close");
        return false;
    });
}

function changePage(toPage,opts) {
    opts = opts || {};
    if (toPage.indexOf("#") !== 0) toPage = "#"+toPage;

    $("body").pagecontainer("change",toPage,opts);
}

// Close the panel before page transition to avoid bug in jQM 1.4+
function changeFromPanel(func) {
    var $panel = $("#sprinklers-settings");
    $panel.one("panelclose", func);
    $panel.panel("close");
}

// show error message
function showerror(msg,dur) {
    dur = dur || 2500;

    $.mobile.loading('show', {
        text: msg,
        textVisible: true,
        textonly: true,
        theme: 'b'
    });
    // hide after delay
    setTimeout(function(){$.mobile.loading('hide');},dur);
}

function iab(url) {
    var iOS = /iP(ad|hone|od)/.test(navigator.userAgent),
        wp8 = /IEMobile/.test(navigator.userAgent),
        dest = "_blank";

    if (iOS || wp8) dest = "_system";

    window.open(url,dest,'enableViewportScale=yes');
}

// Accessory functions
function fixInputClick(page) {
    // Handle Fast Click quirks
    if (!FastClick.notNeeded(document.body)) {
        page.find("input[type='checkbox']:not([data-role='flipswitch'])").addClass("needsclick");
        page.find(".ui-collapsible-heading-toggle").on("click",function(){
            var heading = $(this);

            setTimeout(function(){
                heading.removeClass("ui-btn-active");
            },100);
        });
    }
}

// Convert all elements in array to integer
function parseIntArray(arr) {
    for(var i=0; i<arr.length; i++) {arr[i] = +arr[i];}
    return arr;
}

// Convert seconds into (HH:)MM:SS format. HH is only reported if greater than 0.
function sec2hms(diff) {
    var str = "";
    var hours = parseInt( diff / 3600 ) % 24;
    var minutes = parseInt( diff / 60 ) % 60;
    var seconds = diff % 60;
    if (hours) str += pad(hours)+":";
    return str+pad(minutes)+":"+pad(seconds);
}

// Add ability to unique sort arrays
function getUnique(inputArray) {
    var outputArray = [];
    for (var i = 0; i < inputArray.length; i++) {
        if ((jQuery.inArray(inputArray[i], outputArray)) == -1) outputArray.push(inputArray[i]);
    }
    return outputArray;
}

// pad a single digit with a leading zero
function pad(number) {
    var r = String(number);
    if ( r.length === 1 ) {
        r = '0' + r;
    }
    return r;
}

//Localization functions
function _(key) {
    //Translate item (key) based on currently defined language
    if (typeof window.language === "object" && window.language.hasOwnProperty(key)) {
        var trans = window.language[key];
        return trans ? trans : key;
    } else {
        //If English
        return key;
    }
}

function set_lang() {
    //Update all static elements to the current language
    $("[data-translate]").text(function() {
        var el = $(this),
            txt = el.data("translate");

        if (el.is("input[type='submit']")) {
            el.val(_(txt));
        } else {
            return _(txt);
        }
    });
    $(".ui-toolbar-back-btn").text(_("Back"));
    $.mobile.toolbar.prototype.options.backBtnText = _("Back");
}

function get_locale() {
    //Identify the current browser's locale
    var locale = "en",
        lang = localStorage.getItem("lang");

    locale = lang || navigator.language || navigator.browserLanguage || navigator.systemLanguage || navigator.userLanguage || locale;

    return locale.substring(0,2);
}

function update_lang(lang) {
    //Empty out the current language (English is provided as the key)
    window.language = {};

    if (lang == "en") {
        localStorage.setItem("lang","en");
        set_lang();
        check_curr_lang();
        return;
    }

    $.getJSON("locale/"+lang+".json",function(store){
        window.language = store.messages;
        localStorage.setItem("lang",lang);
        set_lang();
        check_curr_lang();
    }).fail(set_lang);
}

function check_curr_lang() {
    var curr_lang = localStorage.getItem("lang");

    $("#localization").find("a").each(function(a,b){
        var item = $(b);
        if (item.attr("href").match(/'(\w+)'/)[1] == curr_lang) {
            item.removeClass("ui-icon-carat-r").addClass("ui-icon-check");
        } else {
            item.removeClass("ui-icon-check").addClass("ui-icon-carat-r");
        }
    });
}

function dateToString(date) {
    var lang = localStorage.getItem("lang");

    if (lang == "de") {
        date.setMinutes(date.getMinutes()+date.getTimezoneOffset());
        return pad(date.getDate())+"."+pad(date.getMonth())+"."+date.getFullYear()+" "+pad(date.getHours())+":"+pad(date.getMinutes())+":"+pad(date.getSeconds());
    }

    return date.toUTCString().slice(0,-4);
}

function tzToString(prefix,tz,offset) {
    var lang = localStorage.getItem("lang");

    if (lang == "de") return "";

    return prefix+tz+" "+offset;
}
