<div data-role="page" id="addnew">
    <div data-role="header" data-position="fixed">
        <h1>New User</h1>
        <a href="#login" data-icon="delete">Cancel</a>
        <a href="javascript:submit_newuser()">Submit</a>
   </div>
    <div data-role="content" style="top:28px">
        <form action="javascript:submit_newuser()" method="post" id="newuser">
            <ul data-inset="true" data-role="listview">
                <li data-role="list-divider">Add New User</li>
                <li>
                    <div data-role="fieldcontain">
                        <label for="username">Username:</label>
                        <input autocapitalize="off" autocorrect="off" type="text" name="username" id="username" value="" />
                        <label for="password">Password:</label>
                        <input type="password" name="password" id="password" value="" />
                        <label for="email">Email:</label>
                        <input type="email" name="email" id="email" value="" />
                    </div>
                </li>
            </ul>
            <p align='center'>Note: OpenSprinkler IP can be either an IP or hostname. You can also specify a port by using IP:Port</p>
            <ul data-inset="true" data-role="listview">
                <li data-role="list-divider">OpenSprinkler Configuration</li>
                <li>
                    <div data-role="fieldcontain">
                        <label for="os_ip">Open Sprinkler IP:</label>
                        <input type="text" name="os_ip" id="os_ip" value="192.168.1.102" />
                        <label for="os_pw">Open Sprinkler Password:</label>
                        <input type="password" name="os_pw" id="os_pw" value="" />
                    </div>
                </li>
            </ul>
            <input type="submit" value="Submit" />
        </form>
    </div>
    <script>
        function submit_newuser() {
            $.mobile.showPageLoadingMsg()
            //Submit form data to the server
            $.get("index.php","action=add_user&"+$("#newuser").find(":input").serialize(),function(data){
                $.mobile.hidePageLoadingMsg()
                if (data == 1) {
                    $.mobile.changePage($("#login"));
                    showerror("User added successfully.")
                } else if (data == 2) {
                    showerror("Unable to reach OpenSprinkler. Check IP/Port and try again.")
                } else if (data == 3) {
                    showerror("Invalid username or password.")
                } else {
                    showerror("Unable to add the user at this time. Please try again later or contact an admin.")
                }
            })
        }
    </script>
</div>