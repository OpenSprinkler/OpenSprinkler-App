<?php
#Start session
if(!isset($_SESSION)) session_start();

if(!defined('Sprinklers')) {

    #Tell main we are calling it
    define('Sprinklers', TRUE);

    #Required files
    require_once "../main.php";
    
    header("Content-type: application/x-javascript");
}

#Kick if not authenticated
if (!is_auth()) {header($_SERVER['SERVER_PROTOCOL'].' 404 Not Found', true, 404);exit();}

#Echo token so browser can cache it for automatic logins
if (isset($_SESSION['sendtoken']) && $_SESSION['sendtoken']) { echo "localStorage.setItem('token', '".$_SESSION['token']."');\n"; $_SESSION['sendtoken'] = false; }
?>
//After main page is processed, hide loading message and change to the page
$(document).one("pageinit","#sprinklers", function(){
    $.mobile.hidePageLoadingMsg();
    $.mobile.changePage($("#sprinklers"));
});

//Event bind swipe actions to show/hide side panel
$(document).on("swiperight swipeleft", function(e){
    //Define specific action triggered
    eventtype = e.type;
    //Grab the calling page
    page = $(e.target).closest(".ui-page-active");
    //Save the calling page's ID
    pageid = page.attr("id");
    //Grab the panel associated with the calling page
    panel = page.find("[id$=settings]");

    //If the panel is open then close the panel
    if (panel.length != 0 && !panel.hasClass("ui-panel-closed")) {
        return false;
    }

    //If the action is swiperight and where on the main page then expose the panel
    if (eventtype == "swiperight" && pageid == "sprinklers") {
        //If the panel is not found ignore
        if (panel.length == 0) return;
        panel.panel("open");
    }
});

$("#preview_date").change(function(){
    id = $(".ui-page-active").attr("id");
    if (id == "preview") get_preview()
});

//Bind changes to the flip switches
$("select[data-role='slider']").change(function(){
    var slide = $(this);
    var type = this.name;
    var pageid = slide.closest(".ui-page-active").attr("id");
    //Find out what the switch was changed to
    var changedTo = slide.val();
    if(window.sliders[type]!==changedTo){
        if (changedTo=="on") {
            //If chanegd to on
            if (type === "autologin") {
                if (localStorage.getItem("token") != null) return;
                $("#login form").attr("action","javascript:grab_token('"+pageid+"')");
                $.mobile.changePage($("#login"));
            }
            if (type === "en") {
                $.get("index.php","action=en_on",function(result){
                    //If switch failed then change the switch back and show error
                    if (result == 0) {
                        comm_error()
                        $("#en").val("off").slider("refresh")
                    }
                });
            }
            if (type === "mm" || type === "mmm") {
                $.get("index.php","action=mm_on",function(result){
                    if (result == 0) {
                        comm_error()
                        $("#mm,#mmm").val("off").slider("refresh")
                    }
                });
                $("#mm,#mmm").val("on").slider("refresh");
            }
        } else {
            //If chanegd to off
            if (type === "autologin") {
                localStorage.removeItem(typeToKey(type));
            }
            if (type === "en") {
                $.get("index.php","action=en_off",function(result){
                    if (result == 0) {
                        comm_error()
                        $("#en").val("on").slider("refresh")
                    }
                });
            }
            if (type === "mm" || type === "mmm") {
                $.get("index.php","action=mm_off",function(result){
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
    }
});

function comm_error() {
    showerror("Error communicating with OpenSprinkler. Please check your password is correct.")
}

$("#sprinklers,#status").on("pagebeforeshow",function(e,data){
    var newpage = e.target.id;
     
    if (newpage == "sprinklers") {
        //Add a new tip to the header of main page on each page load
        new_tip();
    }
});

//This bind intercepts most links to remove the 300ms delay iOS adds
$(document).on('pageinit', function (e, data) {
    var newpage = e.target.id;

    if (newpage == "sprinklers" || newpage == "status" || newpage == "manual" || newpage == "programs") {
        currpage = $(e.target);

        currpage.find("a[data-rel=back]").bind('vclick', function (e) {
            e.preventDefault(); e.stopImmediatePropagation();
            highlight(this);
            history.back();
        })
        currpage.find("a[data-rel=close]").bind('vclick', function (e) {
            e.preventDefault(); e.stopImmediatePropagation();
            highlight(this);
            $(".ui-page-active [id$=settings]").panel("close");
        })
        currpage.find("a[href='#"+currpage.attr('id')+"-settings']").bind('vclick', function (e) {
            e.preventDefault(); e.stopImmediatePropagation();
            highlight(this);
            $(".ui-page-active [id$=settings]").panel("open");
        });
        currpage.find("a[href^=javascript\\:]").bind('vclick', function (e) {
            e.preventDefault(); e.stopImmediatePropagation();
            var func = $(this).attr("href").split("javascript:")[1];
            highlight(this);
            eval(func);
        });
    }
});

$(document).on("pageshow",function(e,data){
    newpage = e.target.id;

    if (newpage == "sprinklers") {
        //Automatically update sliders on page load in settings panel
        check_auto($("#"+newpage+" select[data-role='slider']"));
    }

});

function check_auto(sliders){
    if (typeof(window.sliders) !== "object") window.sliders = [];
    sliders.each(function(i){
        var type = this.name;
        var item = typeToKey(type);
        if (!item) return;
        if (localStorage.getItem(item) != null) {
            window.sliders[type] = "on";
            $(this).val("on").slider("refresh");
        } else {
            window.sliders[type] = "off";
            $(this).val("off").slider("refresh");
        }
    })
}

function typeToKey(type) {
    if (type == "autologin") {
        return "token";
    } else {
        return false;
    }
}

function highlight(button) {
    $(button).addClass("ui-btn-active").delay(150).queue(function(next){
        $(this).removeClass("ui-btn-active");
        next();
    });
}

function grab_token(pageid){
    $.mobile.showPageLoadingMsg();
    var parameters = "action=gettoken&username=" + $('#username').val() + "&password=" + $('#password').val() + "&remember=" + $('#remember').is(':checked');
    if (!$('#remember').is(':checked')) {
        $("#"+pageid+"-autologin").val("off").slider("refresh");
        window.sliders["autologin"] = "off";
        $.mobile.changePage($("#"+pageid));
        return;
    }
    $.post("index.php",parameters,function(reply){
        $.mobile.hidePageLoadingMsg();
        if (reply == 0) {
            showerror("Invalid Login");
            $.mobile.changePage($("#"+pageid));
        } else if (reply === "") {
            $("#"+pageid+"-autologin").val("off").slider("refresh");
            window.sliders["autologin"] = "off";
            $.mobile.changePage($("#"+pageid));
        } else {
            localStorage.setItem('token',reply);
            $.mobile.changePage($("#"+pageid));
        }
    }, "text");
    $("#login form").attr("action","javascript:dologin()");
}

function new_tip() {
    var tips = [
        "Be sure to disable manual mode otherwise programs will not run",
        "The status page highlights active sprinklers in green and inactive in red",
        "Logs allow you to view historical activity of your sprinkler system",
        "Slide to the right to expose the settings panel"
    ];
    var i = Math.floor((Math.random()*tips.length));
    $("#tip").html("Tip: "+tips[i]);
}

function logout(){
    if (confirm('Are you sure you want to logout?')) {
        $.get("index.php", "action=logout",function(){
            localStorage.removeItem('token');
            $("#container div[data-role='page']:not('.ui-page-active')").remove();
            $('.ui-page-active').one("pagehide",function(){
                $(this).remove();
            })
            $.mobile.changePage($("#login"));
        });
    }
}

function gohome() {
    $.mobile.changePage($('#sprinklers'), {reverse: true, transition: "slidefade"});
}

function show_settings() {
    $.mobile.showPageLoadingMsg();
    $.get("index.php","action=make_settings_list",function(items){
        container = $("#os-settings div[data-role='content']");
        container.html(items);
        container.children().trigger("create")
        if (container.hasClass("ui-content")) {
            container.find("ul").each(function(a,b){
                list = $(b)
                list.listview();
            })
        }
        $.mobile.hidePageLoadingMsg();
        $.mobile.changePage($("#os-settings"));
    })    
}

function get_status() {
    $.mobile.showPageLoadingMsg();
    $.get("index.php","action=make_list_status",function(items){
        list = $("#status_list");
        list.html(items);
        if (list.hasClass("ui-listview")) list.listview("refresh");
        $.mobile.hidePageLoadingMsg();
        $.mobile.changePage($("#status"));
    })
}

function get_manual() {
    $.mobile.showPageLoadingMsg();
    $.get("index.php","action=make_list_manual",function(items){
        list = $("#mm_list");
        list.html(items);
        if (list.hasClass("ui-listview")) list.listview("refresh");
        $.mobile.hidePageLoadingMsg();
        $.mobile.changePage($("#manual"));
    })
}

function get_runonce() {
    $.mobile.showPageLoadingMsg();
    $.get("index.php","action=make_runonce",function(items){
        list = $("#runonce_list");
        list.html(items);
        list.trigger("create");
        $.mobile.hidePageLoadingMsg();
        $.mobile.changePage($("#runonce"));
    })
}

function get_preview() {
    $.mobile.showPageLoadingMsg();
    date = $("#preview_date").val().split("-");
    $.get("index.php","action=get_preview&d="+date[2]+"&m="+date[1]+"&y="+date[0],function(items){
        list = $("#preview div[data-role='content']");
        if (items == "") {
            list.html("<p align='center'>No stations set to run on this day.</p>")
        } else {
            list.html(items);
        }
        $.mobile.hidePageLoadingMsg();
        $.mobile.changePage($("#preview"));
    })
}

function get_programs() {
    $.mobile.showPageLoadingMsg();
    $.get("index.php","action=make_list_programs",function(items){
        list = $("#programs_list");
        list.html(items);
        $("#programs input[name^='rad_days']").change(function(){
            progid = $(this).attr('id').split("-")[1];
            type = $(this).val().split("-")[0];
            type = type.split("_")[1];
            if (type == "n") {
                old = "week"
            } else {
                old = "n"
            }
            $("#input_days_"+type+"-"+progid).show()
            $("#input_days_"+old+"-"+progid).hide()
        })

        //Stupidest bug fix ever but it works...
        $("#programs [type='checkbox']").change(function(){
            window.scrollTo(1,1)
        })
        $("#programs [id^='submit-']").click(function(){
            submit_program($(this).attr("id").split("-")[1]);
        })
        $("#programs [id^='s_checkall-']").click(function(){
            id = $(this).attr("id").split("-")[1]
            $("[id^='station_'][id$='-"+id+"']").prop("checked",true).checkboxradio("refresh");
        })
        $("#programs [id^='s_uncheckall-']").click(function(){
            id = $(this).attr("id").split("-")[1]
            $("[id^='station_'][id$='-"+id+"']").prop("checked",false).checkboxradio("refresh");
        })
        $("#programs [id^='delete-']").click(function(){
            delete_program($(this).attr("id").split("-")[1]);
        })
        $.mobile.hidePageLoadingMsg();
        $("#programs").trigger("create");
        $.mobile.changePage($("#programs"));
    })
}

function add_program() {
    $.mobile.showPageLoadingMsg();
    $.get("index.php","action=fresh_program",function(items){
        list = $("#newprogram");
        list.html(items);
        $("#addprogram input[name^='rad_days']").change(function(){
            progid = "new";
            type = $(this).val().split("-")[0];
            type = type.split("_")[1];
            if (type == "n") {
                old = "week"
            } else {
                old = "n"
            }
            $("#input_days_"+type+"-"+progid).show()
            $("#input_days_"+old+"-"+progid).hide()
        })
        //Stupidest bug fix ever but it works...
        $("#addprogram [type='checkbox']").change(function(){
            window.scrollTo(1,1)
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
    if(!confirm("Are you sure you want to delete program "+(parseInt(id)+1)+"?")) return false;
    $.mobile.showPageLoadingMsg();
    $.get("index.php","action=delete_program&pid="+id,function(result){
        $.mobile.hidePageLoadingMsg();
        if (result == 0) {
            comm_error()
        } else {
            get_programs()
        }
    })
}

function submit_program(id) {
    program = []
    days=[0,0]
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

    start = $("#start-"+id).val().split(":")
    program[3] = parseInt(start[0])*60+parseInt(start[1])
    end = $("#end-"+id).val().split(":")
    program[4] = parseInt(end[0])*60+parseInt(end[1])

    if(!(program[3]<program[4])) {showerror("Error: Start time must be prior to end time.");return;}

    program[5] = parseInt($("#interval-"+id).val())
    program[6] = $("#duration-"+id).val() * 60

    sel = $("[id^=station_][id$=-"+id+"]")
    total = sel.length
    nboards = total / 8


    var stations=[0],station_selected=0,bid;
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
        $.get("index.php","action=update_program&pid=-1&data="+program,function(result){
            $.mobile.hidePageLoadingMsg()
            if (result == 0) comm_error()
            get_programs()
        });
    } else {
        $.get("index.php","action=update_program&pid="+id+"&data="+program,function(result){
            $.mobile.hidePageLoadingMsg()
            if (result == 0) {
                comm_error()
            } else {
                showerror("Program has been updated.")
            }
        });
    }
}

function submit_settings() {
    var opt = {}
    var names = {}
    invalid = false
    $("#os-settings").find(":input").each(function(a,b){
        $item = $(b)
        id = $item.attr('id')
        data = $item.val()
        switch (id) {
            case "o1":
                tz = data.split(":")
                tz[0] = parseInt(tz[0],10);
                tz[1] = parseInt(tz[1],10);
                tz[1]=(tz[1]/15>>0)/4.0;tz[0]=tz[0]+(tz[0]>=0?tz[1]:-tz[1]);
                data = ((tz[0]+12)*4)>>0
                break;
            case "o16":
            case "o21":
            case "o22":
            case "o25":
                data = $item.is(":checked")
                if (!data) return true
                break;
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
        }
        opt[id] = data
    })
    if (invalid) return
    $.mobile.showPageLoadingMsg();
    $.get("index.php","action=submit_options&options="+JSON.stringify(opt)+"&names="+JSON.stringify(names),function(data){
        $.mobile.hidePageLoadingMsg();
        gohome();
        showerror("Settings Have Been Saved")
    })
}

function submit_runonce() {
    runonce = []
    $("#runonce").find(":input[data-type='range']").each(function(a,b){
        runonce.push(parseInt($(b).val())*60)
    })
    $.get("index.php","action=runonce&data="+JSON.stringify(runonce),function(result){
        if (result == 0) {
            comm_error()
        } else {
            showerror("Run-once program has been scheduled")
        }
    })
    gohome();
}

function toggle() {
    if ($("#mm").val() == "off") return;
    var $list = $("#mm_list");
    $anchor = $list.find(".ui-btn-active");
    $listitems = $list.children("li:not(li.ui-li-divider)");
    $item = $anchor.closest("li:not(li.ui-li-divider)");
    var currPos = $listitems.index($item) + 1;
    var total = $listitems.length;
    if ($anchor.hasClass("green")) {
        $.get("index.php","action=spoff&zone="+currPos,function(result){
            if (result == 0) {
                $anchor.addClass("green");
                comm_error()
            }
        })
        $anchor.removeClass("green");
    } else {
        $.get("index.php","action=spon&zone="+currPos,function(result){
            if (result == 0) {
                $anchor.removeClass("green");
                comm_error()
            }
        })
        $anchor.addClass("green");
    }
}

function raindelay() {
    $.get("index.php","action=raindelay&delay="+$("#delay").val(),function(result){
        if (result == 0) comm_error()
    });
    gohome();
}

function rbt() {
    if(!confirm("Are you sure you want to restart the device?")) return false;
    $.mobile.showPageLoadingMsg()
    $.get("index.php","action=rbt",function(result){
        $.mobile.hidePageLoadingMsg()
        $("#sprinklers-settings").panel("close")
        if (result == 0) {
            comm_error()
        } else {
            showerror("OpenSprinkler was rebooted.")
        }
    });

}

function rsn() {
    $.mobile.showPageLoadingMsg()
    $.get("index.php","action=rsn",function(result){
        $.mobile.hidePageLoadingMsg()
        if (result == 0) {
            comm_error()
        } else {
            showerror("All stations have been stopped")
        }
    });
}

function export_config() {
    $.mobile.showPageLoadingMsg();
    $.get("index.php","action=export_config",function(data){
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
    if(!confirm("Are you sure you want to restore the configuration?")) return false;
    $.mobile.showPageLoadingMsg();
    $.get("index.php","action=import_config&data="+data,function(reply){
        $.mobile.hidePageLoadingMsg();
        $("#sprinklers-settings").panel("close")
        if (reply == 0) {
            comm_error()
        } else {
            showerror("Backup restored to your device");
        }
    })
}