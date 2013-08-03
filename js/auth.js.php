<?php
#Start session
if(!isset($_SESSION)) session_start();

if(!defined('Sprinklers')) {

    #Tell main we are calling it
    define('Sprinklers', TRUE);

    #Required files
    require_once "../main.php";

    #Set required header for javascript file    
    header("Content-type: application/x-javascript");
}
?>

//After jQuery mobile is loaded set intial configuration
$(document).one("mobileinit", function(e){
	$.mobile.pageContainer = $('#container');
    $.mobile.defaultPageTransition = 'fade';
    $.mobile.hashListeningEnabled = false;
});

//When the start page is intialized show the body (this prevents the flicker as jQuery mobile loads to process the page)
$("#start").on("pageinit",function(e){
    $("body").show();
});

//On intial load check if a valid token exists, for auto login
$("#start").on("pageshow",function(e){
    if (!check_token()) {
        $.mobile.changePage($("#login"));
    }
});

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

//Authentication functions

//Check token, and if valid load the main page
function check_token() {
    var token = localStorage.getItem('token');
    var parameters = "action=checktoken&token=" + token;
    if (typeof(token) !== 'undefined' && token != null) {
        $.mobile.showPageLoadingMsg();
        $.post("index.php",parameters,function(reply){
            if (reply == 0) {
                $.mobile.hidePageLoadingMsg();
                localStorage.removeItem('token');
                $.mobile.changePage($("#login"));
                return;
            } else {
                $("#container").append(reply);
                $("#sprinklers").page();
            }
        }, "html");
    } else {
        return false;
    }
    return true;
}

//Submit login information to server
function dologin() {
    var parameters = "action=login&username=" + $('#username').val() + "&password=" + $('#password').val() + "&remember=" + $('#remember').is(':checked');
    $("#username, #password").val('');
    $.mobile.showPageLoadingMsg();
    $.post("index.php",parameters,function(reply){
        if (reply == 0) {
            $.mobile.hidePageLoadingMsg();
            showerror("Invalid Login");
        } else {
            $("#container").append(reply);
            $("#sprinklers").page();
        }
    },"html");
}

// show error message
function showerror(msg) {
        $.mobile.loading( 'show', {
            text: msg,
            textVisible: true,
            textonly: true,
            theme: 'a'
            });
	// hide after delay
	setTimeout( function(){$.mobile.loading('hide')}, 1500);
}