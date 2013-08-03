<?php
#Start session
if(!isset($_SESSION)) session_start(); 

#Tell main we are calling it
define('Sprinklers', TRUE);

#Source required files
require_once "main.php";

#Check if authenticated
is_auth();
?>

<!DOCTYPE html>
<html>
	<head>
    	<title>Sprinkler System</title> 
    	<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
        <meta name="viewport" content="initial-scale=1.0,user-scalable=no,maximum-scale=1" media="(device-height: 568px)" />
    	<meta content="yes" name="apple-mobile-web-app-capable">
        <meta name="apple-mobile-web-app-title" content="Sprinklers">
    	<link rel="apple-touch-icon" href="img/icon.png">
    	<link rel="stylesheet" href="css/jquery.mobile-1.3.0.min.css" />
        <link rel="stylesheet" href="css/main.css" />
    </head> 
    <body style="display:none">
    	<div id="container">
            
            <div data-role="page" data-theme="a" id="start"></div>
            
            <div data-role="dialog" id="login" data-theme="a" data-close-btn="none">
            	<div data-role="header" data-position="fixed">
                    <h1>Welcome</h1>
               </div>
            	<div data-role="content">
                    <form action="javascript:dologin()" method="post">
                        <fieldset>
                            <label for="username" class="ui-hidden-accessible">Username:</label>
                            <input autocapitalize="off" autocorrect="off" type="text" name="username" id="username" value="" placeholder="username" data-theme="a" />
                            <label for="password" class="ui-hidden-accessible">Password:</label>
                            <input type="password" name="password" id="password" value="" placeholder="password" data-theme="a" />
                            <label><input type="checkbox" id="remember" name="remember" />Remember Me</label>
                            <button type="submit" data-theme="b">Sign in</button>
                        </fieldset>
                    </form>
                    <a data-role="button" href="add.php">New User?</a>
                </div>
            </div>
        </div>

        <script src="//ajax.googleapis.com/ajax/libs/jquery/1.9.1/jquery.min.js"></script>
        <script><?php include_once("js/auth.js.php"); ?></script>
        <script src="js/jquery.mobile-1.3.0.min.js"></script>
    </body>
</html>