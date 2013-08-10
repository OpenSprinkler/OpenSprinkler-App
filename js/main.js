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

//After jQuery mobile is loaded set intial configuration
$(document).one("mobileinit", function(e){
    $.mobile.defaultPageTransition = 'fade';
    $.mobile.defaultDialogTransition = 'fade';
    $.mobile.hashListeningEnabled = false;
});

//Set AJAX timeout
$.ajaxSetup({
    timeout: 10000
});

//Handle timeout
$(document).ajaxError(function(x,t,m) {
    if(t.statusText==="timeout") {
        if (m.url.search("action=get_weather")) {
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

//On intial load check if a valid token exists, for auto login
$("#start").one("pageinit",function(e){
    $("body").show()
    if (!check_configured()) {
        $.mobile.changePage($("#addnew"),{transition:"none"});
    } else {
        $.get("index.php","os_ip="+localStorage.getItem("os_ip")+"&os_pw="+localStorage.getItem("os_pw")+"&action=send_en_mm",function(data){
            data = JSON.parse(data)
            if (data.en == "1") $("#en").val("on")
            if (data.mm == "1") $("#mm,#mmm").val("on")
            $.mobile.changePage($("#sprinklers"),{transition:"none"})
        })
    }
    var date = new Date();
    var y = date.getFullYear();
    var m = String(date.getMonth()+1);
    if (m.length == 1) m = "0"+m;
    var d = String(date.getDate());
    if (d.length == 1) d = "0"+d;
    $("#preview_date").val(y+"-"+m+"-"+d);
});

$(document).on("pageshow",function(e,data){
    var newpage = e.target.id;

    if (newpage == "preview") {
        get_preview();
    }
});

function check_configured() {
    if (localStorage.getItem("os_ip") === null || localStorage.getItem("os_pw") === null) return false
    return true
}

// show error message
function showerror(msg) {
        $.mobile.loading( 'show', {
            text: msg,
            textVisible: true,
            textonly: true,
            theme: 'c'
            });
    // hide after delay
    setTimeout( function(){$.mobile.loading('hide')}, 1500);
}

$("#preview_date").change(function(){
    var id = $(".ui-page-active").attr("id");
    if (id == "preview") get_preview()
});

//Bind changes to the flip switches
$("select[data-role='slider']").change(function(){
    var slide = $(this);
    var type = this.name;
    var pageid = slide.closest(".ui-page-active").attr("id");
    //Find out what the switch was changed to
    var changedTo = slide.val();
    if (changedTo=="on") {
        if (type === "en") {
            $.get("index.php","os_ip="+localStorage.getItem("os_ip")+"&os_pw="+localStorage.getItem("os_pw")+"&action=en_on",function(result){
                //If switch failed then change the switch back and show error
                if (result == 0) {
                    comm_error()
                    $("#en").val("off").slider("refresh")
                }
            });
        }
        if (type === "mm" || type === "mmm") {
            $.get("index.php","os_ip="+localStorage.getItem("os_ip")+"&os_pw="+localStorage.getItem("os_pw")+"&action=mm_on",function(result){
                if (result == 0) {
                    comm_error()
                    $("#mm,#mmm").val("off").slider("refresh")
                }
            });
            //If switched to off, unhighlight all of the zones highlighted in green since all will be disabled automatically
            $("#manual a.green").removeClass("green");
            $("#mm,#mmm").val("on").slider("refresh");
        }
    } else {
        if (type === "en") {
            $.get("index.php","os_ip="+localStorage.getItem("os_ip")+"&os_pw="+localStorage.getItem("os_pw")+"&action=en_off",function(result){
                if (result == 0) {
                    comm_error()
                    $("#en").val("on").slider("refresh")
                }
            });
        }
        if (type === "mm" || type === "mmm") {
            $.get("index.php","os_ip="+localStorage.getItem("os_ip")+"&os_pw="+localStorage.getItem("os_pw")+"&action=mm_off",function(result){
                if (result == 0) {
                    comm_error()
                    $("#mm,#mmm").val("on").slider("refresh")
                }
            });
            //If switched to off, unhighlight all of the manual zones highlighted in green since all will be disabled automatically
            $("#manual a.green").removeClass("green");
            $("#mm,#mmm").val("off").slider("refresh");
        }
    }
});

function comm_error() {
    showerror("Error communicating with OpenSprinkler. Please check your password is correct.")
}

function check_status() {
    //Check if a program is running
    $.get("index.php","os_ip="+localStorage.getItem("os_ip")+"&os_pw="+localStorage.getItem("os_pw")+"&action=current_status",function(data){
        var footer = $("#footer-running")
        if (data === "") {
            footer.slideUp();
            return;
        }
        data = JSON.parse(data);
        if (window.interval_id !== undefined) clearInterval(window.interval_id);
        if (window.timeout_id !== undefined) clearTimeout(window.timeout_id);
        if (data.seconds != 0) update_timer(data.seconds,data.sdelay);
        footer.removeClass().addClass(data.color).html(data.line).slideDown();
    })
}

function update_timer(total,sdelay) {
    window.lastCheck = new Date().getTime();
     window.interval_id = setInterval(function(){
        var now = new Date().getTime();
        var diff = now - window.lastCheck;
        if (diff > 3000) {
            clearInterval(window.interval_id);
            $("#footer-running").html("<p style='margin:0;text-align:center;opacity:0.18'><img src='img/ajax-loader.gif' class='mini-load' /></p>");
            check_status();
        }
        window.lastCheck = now;
        if (total <= 0) {
            clearInterval(window.interval_id);
            $("#footer-running").slideUp().html("<p style='margin:0;text-align:center;opacity:0.18'><img src='img/ajax-loader.gif' class='mini-load' /></p>");
            if (window.timeout_id !== undefined) clearTimeout(window.timeout_id);
            window.timeout_id = setTimeout(check_status,(sdelay*1000));
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
    if (hours) str += (hours < 10 ? "0"+hours : hours)+":";
    return str+(minutes < 10 ? "0"+minutes : minutes)+":"+(seconds < 10 ? "0"+seconds : seconds);
}

$(document).on("pagebeforeshow",function(e,data){
    var newpage = e.target.id;

    if (newpage == "sprinklers") {
        update_weather();
        $("#footer-running").html("<p style='margin:0;text-align:center;opacity:0.18'><img src='img/ajax-loader.gif' class='mini-load' /></p>");
        setTimeout(check_status,1000);
    } else {
        clearInterval(window.interval_id);
        var title = document.title;
        document.title = "OpenSprinkler: "+title;
    }    
});

//This bind intercepts most links to remove the 300ms delay iOS adds
$(document).on('pageinit', function (e, data) {
    var newpage = e.target.id;
    var currpage = $(e.target);

    currpage.find("a[href='#"+currpage.attr('id')+"-settings']").on('vclick', function (e) {
        e.preventDefault(); e.stopImmediatePropagation();
        highlight(this);
        $(".ui-page-active [id$=settings]").panel("open");
    });
    currpage.find("a[data-onclick]").on('vclick', function (e) {
        e.preventDefault(); e.stopImmediatePropagation();
        var func = $(this).data("onclick");
        highlight(this);
        eval(func);
    });
});

function highlight(button) {
    $(button).addClass("ui-btn-active").delay(150).queue(function(next){
        $(this).removeClass("ui-btn-active");
        next();
    });
}

function update_weather() {
    var $weather = $("#weather");
    $weather.html("<p style='margin:0;text-align:center;opacity:0.18'><img src='img/ajax-loader.gif' class='mini-load' /></p>");
    $.get("index.php","os_ip="+localStorage.getItem("os_ip")+"&os_pw="+localStorage.getItem("os_pw")+"&action=get_weather",function(result){
        var weather = JSON.parse(result);
        if (weather["code"] == null) {
            $("#weather-list").animate({ 
                "margin-left": "-1000px"
            },1000,function(){
                $(this).hide();
            })
            return;
        }
        $weather.html("<p title='"+weather["text"]+"' class='wicon cond"+weather["code"]+"'></p><span>"+weather["temp"]+"</span><br><span class='location'>"+weather["location"]+"</span>");
        $("#weather-list").animate({ 
            "margin-left": "0"
        },1000).show()
    })
}

function gohome() {
    $.mobile.changePage($('#sprinklers'), {reverse: true});
}

function show_settings() {
    $.mobile.showPageLoadingMsg();
    $.get("index.php","os_ip="+localStorage.getItem("os_ip")+"&os_pw="+localStorage.getItem("os_pw")+"&action=make_settings_list",function(items){
        var list = $("#os-settings-list");
        list.html(items).trigger("create");
        if (list.hasClass("ui-listview")) list.listview("refresh");
        $.mobile.hidePageLoadingMsg();
        $.mobile.changePage($("#os-settings"));
    })    
}

function show_stations() {
    $.mobile.showPageLoadingMsg();
    $.get("index.php","os_ip="+localStorage.getItem("os_ip")+"&os_pw="+localStorage.getItem("os_pw")+"&action=make_stations_list",function(items){
        var list = $("#os-stations-list");
        list.html(items).trigger("create");
        if (list.hasClass("ui-listview")) list.listview("refresh");
        $.mobile.hidePageLoadingMsg();
        $.mobile.changePage($("#os-stations"));
    })    
}

function get_status() {
    $.mobile.showPageLoadingMsg();
    $.get("index.php","os_ip="+localStorage.getItem("os_ip")+"&os_pw="+localStorage.getItem("os_pw")+"&action=make_list_status",function(items){
        var list = $("#status_list");
        items = JSON.parse(items)
        list.html(items.list);
        $("#status_header").html(items.header);
        $("#status_footer").html(items.footer);
        if (list.hasClass("ui-listview")) list.listview("refresh");
        window.totals = JSON.parse(items.totals);
        if (window.interval_id !== undefined) clearInterval(window.interval_id);
        if (window.timeout_id !== undefined) clearTimeout(window.timeout_id);
        $.mobile.hidePageLoadingMsg();
        $.mobile.changePage($("#status"));
        if (window.totals["d"] !== undefined) {
            delete window.totals["p"];
            setTimeout(get_status,window.totals["d"]*1000);
        }
        update_timers(items.sdelay);
    })
}

function get_manual() {
    $.mobile.showPageLoadingMsg();
    $.get("index.php","os_ip="+localStorage.getItem("os_ip")+"&os_pw="+localStorage.getItem("os_pw")+"&action=make_list_manual",function(items){
        var list = $("#mm_list");
        list.html(items);
        if (list.hasClass("ui-listview")) list.listview("refresh");
        $.mobile.hidePageLoadingMsg();
        $.mobile.changePage($("#manual"));
    })
}

function get_runonce() {
    $.mobile.showPageLoadingMsg();
    $.getJSON("index.php","os_ip="+localStorage.getItem("os_ip")+"&os_pw="+localStorage.getItem("os_pw")+"&action=make_runonce",function(items){
        window.rprogs = items.progs;
        var list = $("#runonce_list"), i=0;
        list.html(items.page);

        var progs = "<select data-mini='true' name='rprog' id='rprog'><option value='s'>Quick Programs</option>";
        var data = JSON.parse(localStorage.getItem("runonce"));
        if (data !== null) {
            list.find(":input[data-type='range']").each(function(a,b){
                $(b).val(data[i]/60);
                i++;
            })
            window.rprogs["l"] = data;
            progs += "<option value='l' selected='selected'>Last Used Program</option>";
        }
        for (i=0; i<items.progs.length; i++) {
            progs += "<option value='"+i+"'>Program "+(i+1)+"</option>";
        };
        progs += "</select>";
        $("#runonce_list p").after(progs);
        $("#rprog").change(function(){
            var prog = $(this).val();
            if (prog == "s") {
                reset_runonce()
                return;
            }            if (window.rprogs[prog] == undefined) return;
            fill_runonce(list,window.rprogs[prog]);
        })
        list.trigger("create");
        $.mobile.hidePageLoadingMsg();
        $.mobile.changePage($("#runonce"));
    })
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
    $.mobile.showPageLoadingMsg();
    $.get("index.php","os_ip="+localStorage.getItem("os_ip")+"&os_pw="+localStorage.getItem("os_pw")+"&action=get_preview&d="+date[2]+"&m="+date[1]+"&y="+date[0],function(items){
        var empty = true;
        if (items == "") {
            $("#timeline").html("<p align='center'>No stations set to run on this day.</p>")
        } else {
            empty = false
            var data = eval("["+items.substring(0, items.length - 1)+"]");
            $.each(data, function(){
                this.start = new Date(date[0],date[1]-1,date[2],0,0,this.start);
                this.end = new Date(date[0],date[1]-1,date[2],0,0,this.end);
            })
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
            window.addEventListener("resize",timeline_redraw);
            timeline.draw(data, options);
            if ($(window).width() <= 480) {
                var currRange = timeline.getVisibleChartRange();
                if ((currRange.end.getTime() - currRange.start.getTime()) > 6000000) timeline.setVisibleChartRange(currRange.start,new Date(currRange.start.getTime()+6000000))
            }
            $("#timeline .timeline-groups-text:contains('Master')").addClass("skip-numbering")
            $("#timeline-navigation").show()
        }
        $.mobile.hidePageLoadingMsg();
    })
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
    var m = String(nDate.getMonth()+1);
    if (m.length == 1) m = "0"+m;
    var d = String(nDate.getDate());
    if (d.length == 1) d = "0"+d;
    inputBox.val(nDate.getFullYear() + "-" + m + "-" + d);
    get_preview();
}

function get_programs(pid) {
    $.mobile.showPageLoadingMsg();
    $.get("index.php","os_ip="+localStorage.getItem("os_ip")+"&os_pw="+localStorage.getItem("os_pw")+"&action=make_all_programs",function(items){
        var list = $("#programs_list");
        list.html(items);
        if (typeof pid !== 'undefined') {
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
        $.mobile.hidePageLoadingMsg();
        $("#programs").trigger("create");
        update_program_header();
        $.mobile.changePage($("#programs"));
    })
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

function add_program() {
    $.mobile.showPageLoadingMsg();
    $.get("index.php","os_ip="+localStorage.getItem("os_ip")+"&os_pw="+localStorage.getItem("os_pw")+"&action=fresh_program",function(items){
        var list = $("#newprogram");
        list.html(items);
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
        $.mobile.hidePageLoadingMsg();
        $("#addprogram").trigger("create");
        $.mobile.changePage($("#addprogram"));
    })    
}

function delete_program(id) {
    areYouSure("Are you sure you want to delete program "+(parseInt(id)+1)+"?", "", function() {
        $.mobile.showPageLoadingMsg();
        $.get("index.php","os_ip="+localStorage.getItem("os_ip")+"&os_pw="+localStorage.getItem("os_pw")+"&action=delete_program&pid="+id,function(result){
            $.mobile.hidePageLoadingMsg();
            if (result == 0) {
                comm_error()
            } else {
                get_programs(false)
            }
        })
    },get_programs)
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


    var stations=[0],station_selected=0,bid,sid;
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
    $.mobile.showPageLoadingMsg()
    if (id == "new") {
        $.get("index.php","os_ip="+localStorage.getItem("os_ip")+"&os_pw="+localStorage.getItem("os_pw")+"&action=update_program&pid=-1&data="+program,function(result){
            $.mobile.hidePageLoadingMsg()
            get_programs()
            if (result == 0) {
                setTimeout(comm_error,400)
            } else {
                setTimeout(function(){showerror("Program added successfully")},400)
            }
        });
    } else {
        $.get("index.php","os_ip="+localStorage.getItem("os_ip")+"&os_pw="+localStorage.getItem("os_pw")+"&action=update_program&pid="+id+"&data="+program,function(result){
            $.mobile.hidePageLoadingMsg()
            if (result == 0) {
                comm_error()
            } else {
                update_program_header();
                showerror("Program has been updated")
            }
        });
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
    $.mobile.showPageLoadingMsg();
    $.get("index.php","os_ip="+localStorage.getItem("os_ip")+"&os_pw="+localStorage.getItem("os_pw")+"&action=submit_options&options="+JSON.stringify(opt),function(result){
        $.mobile.hidePageLoadingMsg();
        gohome();
        if (result == 0) {
            comm_error()
        } else {
            showerror("Settings have been saved")
        }
    })
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
                names[id] = encodeURIComponent(data)
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
    if ($("[id^='um_']").length) masop = "&masop="+JSON.stringify(m);
    if (invalid) return
    $.mobile.showPageLoadingMsg();
    $.get("index.php","os_ip="+localStorage.getItem("os_ip")+"&os_pw="+localStorage.getItem("os_pw")+"&action=submit_stations&names="+JSON.stringify(names)+masop,function(result){
        $.mobile.hidePageLoadingMsg();
        gohome();
        if (result == 0) {
            comm_error()
        } else {
            showerror("Stations have been updated")
        }
    })
}

function submit_runonce() {
    var runonce = []
    $("#runonce").find(":input[data-type='range']").each(function(a,b){
        runonce.push(parseInt($(b).val())*60)
    })
    runonce.push(0)
    localStorage.setItem("runonce",JSON.stringify(runonce));
    $.get("index.php","os_ip="+localStorage.getItem("os_ip")+"&os_pw="+localStorage.getItem("os_pw")+"&action=runonce&data="+JSON.stringify(runonce),function(result){
        if (result == 0) {
            comm_error()
        } else {
            showerror("Run-once program has been scheduled")
        }
    })
    gohome();
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
        $.get("index.php","os_ip="+localStorage.getItem("os_ip")+"&os_pw="+localStorage.getItem("os_pw")+"&action=spoff&zone="+currPos,function(result){
            if (result == 0) {
                $anchor.addClass("green");
                comm_error()
            }
        })
        $anchor.removeClass("green");
    } else {
        $.get("index.php","os_ip="+localStorage.getItem("os_ip")+"&os_pw="+localStorage.getItem("os_pw")+"&action=spon&zone="+currPos,function(result){
            if (result == 0) {
                $anchor.removeClass("green");
                comm_error()
            }
        })
        $anchor.addClass("green");
    }
}

function raindelay() {
    $.mobile.showPageLoadingMsg();
    $.get("index.php","os_ip="+localStorage.getItem("os_ip")+"&os_pw="+localStorage.getItem("os_pw")+"&action=raindelay&delay="+$("#delay").val(),function(result){
        $.mobile.hidePageLoadingMsg();
        gohome();
        if (result == 0) {
            comm_error()
        } else {
            showerror("Rain delay has been successfully set")
        }
    });
}

function rbt() {
    areYouSure("Are you sure you want to reboot OpenSprinkler?", "", function() {
        $.mobile.showPageLoadingMsg()
        $.get("index.php","os_ip="+localStorage.getItem("os_ip")+"&os_pw="+localStorage.getItem("os_pw")+"&action=rbt",function(result){
            $.mobile.hidePageLoadingMsg()
            gohome();
            if (result == 0) {
                comm_error()
            } else {
                showerror("OpenSprinkler is rebooting now")
            }
        });
    },gohome);
}

function rsn() {
    areYouSure("Are you sure you want to stop all stations?", "", function() {
        $.mobile.showPageLoadingMsg()
        $.get("index.php","os_ip="+localStorage.getItem("os_ip")+"&os_pw="+localStorage.getItem("os_pw")+"&action=rsn",function(result){
            $.mobile.hidePageLoadingMsg()
            gohome();
            if (result == 0) {
                comm_error()
            } else {
                showerror("All stations have been stopped")
            }
        });
    },gohome);
}

function export_config() {
    $.mobile.showPageLoadingMsg();
    $.get("index.php","os_ip="+localStorage.getItem("os_ip")+"&os_pw="+localStorage.getItem("os_pw")+"&action=export_config",function(data){
        $.mobile.hidePageLoadingMsg();
        $("#sprinklers-settings").panel("close")
        if (data === "") {
            comm_error()
        } else {
            localStorage.setItem("backup", data);
            showerror("Backup saved to your device");
        }
    })
}

function import_config() {
    var data = localStorage.getItem("backup");
    if (data === null) {
        showerror("No backup available on this device");
        return;
    }
    areYouSure("Are you sure you want to restore the configuration?", "", function() {
        $.mobile.showPageLoadingMsg();
        $.get("index.php","os_ip="+localStorage.getItem("os_ip")+"&os_pw="+localStorage.getItem("os_pw")+"&action=import_config&data="+data,function(reply){
            $.mobile.hidePageLoadingMsg();
            gohome();
            if (reply == 0) {
                comm_error()
            } else {
                showerror("Backup restored to your device");
            }
        })
    },gohome);
}

function areYouSure(text1, text2, callback, callback2) {
    $("#sure .sure-1").text(text1);
    $("#sure .sure-2").text(text2);
    $("#sure .sure-do").unbind("click.sure").on("click.sure", function() {
        callback();
    });
    $("#sure .sure-dont").unbind("click.sure").on("click.sure", function() {
        callback2();
    });
    $.mobile.changePage("#sure");
}

function submit_newuser() {
    document.activeElement.blur();
    $.mobile.showPageLoadingMsg()
    //Locally save information
    localStorage.setItem("os_ip",$("#os_ip").val());
    localStorage.setItem("os_pw",$("#os_pw").val());
    //Submit form data to the server
    $.get("index.php","os_ip="+localStorage.getItem("os_ip")+"&os_pw="+localStorage.getItem("os_pw")+"&action=test_ip&"+$("#os_ip").serialize(),function(data){
        $.mobile.hidePageLoadingMsg()
        if (data == 1) {
            $.get("index.php","os_ip="+localStorage.getItem("os_ip")+"&os_pw="+localStorage.getItem("os_pw")+"&action=send_en_mm",function(data){
                data = JSON.parse(data)
                if (data.en == "1") $("#en").val("on")
                if (data.mm == "1") $("#mm,#mmm").val("on")
                $.mobile.changePage($("#sprinklers"))
            })
        } else {
            showerror("Check IP/Port and try again.")
        }
    })
}

function remove_info() {
    localStorage.removeItem("os_ip");
    localStorage.removeItem("os_pw");
    $.mobile.changePage($("#addnew"));
}

function change_info() {
    $("#addnew div[data-role='header']").append("<a data-role='button' class='ui-btn-left' href='javascript:gohome()'>Cancel</a>").trigger("create");
    $("#os_ip").val(localStorage.getItem("os_ip"));
    $("#os_pw").val(localStorage.getItem("os_pw"));
    $.mobile.changePage($("#addnew"));
}
