#pragma strict

import System.IO;
import System;

class BackendMessage {
    var type:String;
    var message:String[];
    
    function BackendMessage(input:String) {
        type = input[0] + "";
        message = input.Substring(1).Split(";"[0]);
    }
    
    function get isError():boolean {
        return type == "e";
    }
}

//--GLOBAL--
var NetworkManagerPrefab:NetworkManager;
var DefaultMod:TextAsset;

//--LOGIN--

//states
private var loggingIn:boolean = false;
private var registering:boolean = false;
private var loginType:int = 0;
private var loginTypeWeight:float = 1f;

//inputs
private var password2:String = "";
private var email:String = "";
private var loginMessage:String;

//--Main--

//--Server List--
private var hostList:HostData[];
private var host:HostData;
private var selectedServer:int = -1;
private var comments:String[];

//--Options--
private var optionsType: int;

//controls
private var Detect:boolean = false;

//Window Display
private enum Dropdown {none, play, profile, options, quit}
private var dropdown:Dropdown = Dropdown.none;

private enum MenuWindow {home, quickMatch, serverList, startServer, profile, options}
private var window:MenuWindow = MenuWindow.home;

//Text Scaling --
private var swidth:float = 0;
private var sheight:float = 0;
private var windowOffset:Vector2 = Vector2.zero;

//temporary ServerSettings.map texture
var mapTexture:Texture;

//outpost symbol
var image:Texture;

//Custom Styles
private var ScrollPosition:Vector2;

private var ShowWindow:boolean = false;
var Skin:GUISkin;
private var dcip:String = "";
private var IndexList:int;
var MessageBox:boolean = false;

//Temp optional
private var fontSize:float;
private var tmpFloat:float;

//Timers
var refreshTime:float;
private var refreshTimer:float;

function Awake() {
    Settings.defaultMod = DefaultMod;
	Input.eatKeyPressOnTextFieldFocus = false;
	
    Loadout.gunsMain = NetworkManagerPrefab.GetComponent(typeof(NetworkManager)).PlayerPrefab.GetComponent(typeof(Player)).GunsMain;
    Loadout.gunsSecondary = NetworkManagerPrefab.GetComponent(typeof(NetworkManager)).PlayerPrefab.GetComponent(typeof(Player)).GunsSecondary;
    
    //Load all settings
	VideoSettings.Load();
	VideoSettings.Apply();
	SoundSettings.Load();
	SoundSettings.Apply();
	Controls.Load();
	ServerSettings.Load();
	AccountSettings.Load();
    Loadout.Load();
    Loadout.Save();
}

function Start() {
    CheckVersion();
    GetData();
}

function Login() {
    if (loggingIn) {
        return;
    }
	try {
		var www:WWW = WWW(Settings.backend + "/v1/auth/login?username=" + WWW.EscapeURL(AccountSettings.username) + "&password=" + WWW.EscapeURL(AccountSettings.password) + "&source=outpost");
		loggingIn = true;
	}
	catch (err) {
		loginMessage = "Connection Error";
		return;
	}
	
	yield www;
    
    if (!String.IsNullOrEmpty(www.error)) {
        loginMessage = "Connection failed";
        return;
    }
    
    var message:BackendMessage = BackendMessage(www.text);
	
    if (message.isError) {
        loginMessage = message.message[0];
    }
    else {
        AccountSettings.Save();
        AccountSettings.ticket = message.message[0];
        AccountSettings.secureCode = message.message[1];
    }
    
	loggingIn = false;
}

function Register() {
	if (AccountSettings.password == password2) {
		if (AccountSettings.username != "") {
			if (AccountSettings.password != "") {
				if (email != "") {
					try {
						var www:WWW = WWW(Settings.backend + "/v1/auth/register?username=" + WWW.EscapeURL(AccountSettings.username) + "&email=" + WWW.EscapeURL(email) + "&password=" + WWW.EscapeURL(AccountSettings.password) + "&subscription=0" + "&source=outpost");
						registering = true;
					}
					catch (err) {
						loginMessage = "Connection Error";
						return;
					}
                    
					yield www;
					
                    if (!String.IsNullOrEmpty(www.error)) {
                        loginMessage = "Connection failed";
                        return;
                    }
                    
                    var message:BackendMessage = BackendMessage(www.text);
                    
                    if (message.isError) {
                        loginMessage = message.message[0];
                    }
                    else {
                        AccountSettings.Save();
                        AccountSettings.ticket = message.message[0];
                        AccountSettings.secureCode = message.message[1];
                    }
                    
                    registering = false;
				}
				else {
					loginMessage = "No Email";
				}
			}
			else {
				loginMessage = "No Password";
			}
		}
		else {
			loginMessage = "No Username";
		}
	}
	else {
		loginMessage = "Passwords Don't Match";
	}
	registering = false;
}

function CheckVersion() {
	try {
		var www:WWW = WWW(Settings.backend + "/v1/outpost/version");
        loginMessage = "Checking version number";
	}
	catch (err) {
		loginMessage = "Error Connecting";
		return;
	}
	
    yield www;
    
    if (!String.IsNullOrEmpty(www.error)) {
        loginMessage = "Connection failed";
        return;
    }

    var message:BackendMessage = BackendMessage(www.text);

    if (message.isError) {
        loginMessage = message.message[0];
    }
    else if (message.message[0] == Settings.version) {
        Settings.upToDate = true;
        loginMessage = "";
    }
    else {
        loginMessage = "Please Update Outpost";
    }
}

function GetData() {
    var www:WWW = WWW(Settings.backend + "/v1/outpost/global/get");
    
    yield www;
    
    if (!String.IsNullOrEmpty(www.error)) {
        return;
    }
    
    var message:BackendMessage = BackendMessage(www.text);
    
    if (!message.isError) {
        Stats.totalCasulties = Convert.ToInt64(message.message[0]);
        Stats.t1Kills = Convert.ToInt64(message.message[1]);
        Stats.t2Kills = Convert.ToInt64(message.message[2]);
    }
}

function RequestHostList() {
	MasterServer.ClearHostList();
	MasterServer.RequestHostList("OutpostGameV" + Settings.version);
}

function OnGUI () {
    //Set gui style
    swidth = Screen.width;
    sheight = Screen.height;
	fontSize = 8+12*(swidth-360)/(1080-360);
	GUI.skin = Skin;
	GUI.skin.label.fontSize = fontSize;
	GUI.skin.box.fontSize = fontSize;
	GUI.skin.button.fontSize = fontSize;
	GUI.skin.textField.fontSize = fontSize;
	GUI.skin.window.fontSize = fontSize;
	
	if (!Settings.loggedIn) {
        LoginScreen(1);
	}
	else {
        //Draw Dropdowns
        switch (dropdown) {
            case Dropdown.play:
                PlayDropdown();
            break;
            case Dropdown.profile:
                ProfileDropdown();
            break;
            case Dropdown.options:
                OptionsDropdown();
            break;
            case Dropdown.quit:
                QuitDropdown();
            break;
        }
        
        //Draw Screens
        MainMenuScreen(1);
        
        swidth = swidth/12*5 - sheight/20;
        sheight = sheight/20*15;
        windowOffset.x = Screen.width/12*7;
        windowOffset.y = Screen.height/20*2;
        
        switch (window) {
            case MenuWindow.quickMatch:
                QuickMatchScreen(1);
            break;
            case MenuWindow.serverList:
                ServerListScreen(1);
            break;
            case MenuWindow.startServer:
                ServerEditScreen(1);
            break;
            case MenuWindow.profile:
                ProfileScreen(1);
            break;
            case MenuWindow.options:
                OptionsScreen(1);
            break;
            case MenuWindow.home:
                HomeScreen(1);
            break;
        }
        
        swidth = Screen.width;
        sheight = Screen.height;
        windowOffset = Vector2.zero;
	}
}

function Update() {
    //Update GUI weights
    if (loginType == 0) {
        loginTypeWeight += Time.deltaTime;
    }
    else {
        loginTypeWeight -= Time.deltaTime;
    }
    loginTypeWeight = Mathf.Clamp01(loginTypeWeight);
    
    if (refreshTimer < Time.time) {
        GetData();
        refreshTimer = Time.time + refreshTime;
    }
}

function PlayDropdown() {
    GUI.skin.button.fontSize = fontSize - 4;
    GUILayout.BeginArea(Rect(Screen.width/12*3, Screen.height/16, Screen.width/12*2, Screen.height/16*4));
    GUILayout.Space(2);
    
    if (GUILayout.Button("QuickMatch")) {
        window = MenuWindow.quickMatch;
        dropdown = Dropdown.none;
    }
    if (GUILayout.Button("Server List")) {
        RequestHostList();
        window = MenuWindow.serverList;
        dropdown = Dropdown.none;
    }
    if (GUILayout.Button("Host")) {
        window = MenuWindow.startServer;
        dropdown = Dropdown.none;
    }
    
    GUILayout.EndArea();
    GUI.skin.button.fontSize = fontSize;
}

function ProfileDropdown() {
    window = MenuWindow.profile;
    dropdown = Dropdown.none;
}

function OptionsDropdown() {
    window = MenuWindow.options;
    dropdown = Dropdown.none;
}

function QuitDropdown() {
    GUI.skin.button.fontSize = fontSize - 5;
    GUILayout.BeginArea(Rect(Screen.width - Screen.width/12*3 + 4, Screen.height/16, Screen.width/12, Screen.height/16*4));
    GUILayout.Space(2);
    
    if (GUILayout.Button("Logout")) {
        window = MenuWindow.quickMatch;
        dropdown = Dropdown.none;
        AccountSettings.Reset();
        AccountSettings.Load();
    }
    if (GUILayout.Button("Quit")) {
        Application.Quit();
        dropdown = Dropdown.none;
    }
    
    GUILayout.EndArea();
    GUI.skin.button.fontSize = fontSize;
}

function LoginScreen(weight:float) {
    GUI.color.a = weight;
    
    //Draw Layout
    GUI.Box(Rect(swidth/16*5, 0, swidth/16*6, sheight/16*6), "");	
    GUI.Box(Rect(swidth/16*6, sheight/16*6, swidth/16*4, sheight/16*10), "");
    GUI.DrawTexture(Rect(swidth/16*6.5, sheight/16, swidth/16*3, sheight/16*4), image, ScaleMode.ScaleToFit);	
    
    if (Settings.upToDate) {
        if (loginTypeWeight > 0.1) {
            LoginGUI(loginTypeWeight);
        }
        if (loginTypeWeight < 0.9) {
            RegisterGUI(1 - loginTypeWeight);
        }
    }
    else {
        UpdateGUI(1);
    }
    
    GUI.color = Color.white;
}

function LoginGUI(weight:float) {
    GUI.color = Color(1, 1, 1, weight);
    GUILayout.BeginArea(Rect(swidth/16*6, sheight/16*6, swidth/16*4, sheight/16*10 - 4));
    
    GUILayout.Label("Username");
    AccountSettings.username = GUILayout.TextField(AccountSettings.username, 16);
    GUILayout.Label("Password");
    AccountSettings.password = GUILayout.PasswordField(AccountSettings.password, "*"[0], 16);
    
    GUILayout.BeginHorizontal();
    GUILayout.Label("Save Password");
    GUILayout.FlexibleSpace();
    AccountSettings.savePassword = GUILayout.Toggle(AccountSettings.savePassword, "");
    GUILayout.EndHorizontal();
    
    GUILayout.Label(loginMessage);
    
    GUILayout.FlexibleSpace();
    
    if (GUILayout.Button("Login") || (Event.current.type == EventType.KeyDown && Event.current.keyCode == KeyCode.Return)) {
        loginMessage = "Logging In";
        Login();
    }
    GUILayout.BeginHorizontal();
    if (GUILayout.Button("Register")) {
        loginMessage = "";
        loginType = 1;
    }
    if (GUILayout.Button("Offline")) {
        loginMessage = "";
        Settings.offline = true;
    }
    GUILayout.EndHorizontal();
    
    if (GUILayout.Button("Quit")) {
        Application.Quit();
    }
    
    GUILayout.EndArea();
    GUI.color = Color.white;
}

function RegisterGUI(weight:float) {
    GUI.color.a = weight;
    GUILayout.BeginArea(Rect(swidth/16*6, sheight/16*6, swidth/16*4, sheight/16*10 - 4));
    
    GUILayout.Label("Username");
    AccountSettings.username = GUILayout.TextField(AccountSettings.username, 16);
    GUILayout.Label("Email");
    email = GUILayout.TextField(email, 64);
    GUILayout.Label("Password");
    AccountSettings.password = GUILayout.PasswordField(AccountSettings.password, "*"[0], 16);
    GUILayout.Label("Confirm Password");
    password2 = GUILayout.PasswordField(password2, "*"[0], 16);
    
    GUILayout.Label(loginMessage);
    
    GUILayout.FlexibleSpace();
    
    if (GUILayout.Button("Register") || (Event.current.type == EventType.KeyDown && Event.current.keyCode == KeyCode.Return)) {
        loginMessage = "Registering";
        Register();
    }
    GUILayout.BeginHorizontal();
    if (GUILayout.Button("Login")) {
        loginType = 0;
        loginMessage = "";
    }
    if (GUILayout.Button("Offline")) {
        Settings.offline = true;
        loginMessage = "";
    }
    GUILayout.EndHorizontal();
    
    if (GUILayout.Button("Quit")) {
        Application.Quit();
    }
    
    GUILayout.EndArea();
    GUI.color = Color.white;
}

function UpdateGUI(weight:float) {
    GUI.color.a = weight;
    GUILayout.BeginArea(Rect(swidth/16*6, sheight/16*6, swidth/16*4, sheight/16*10 - 4));
    
    GUILayout.FlexibleSpace();
    GUILayout.Label(loginMessage);
    GUILayout.FlexibleSpace();
    
    GUILayout.EndArea();
    GUI.color = Color.white;
}

function MainMenuScreen(weight:float) {
    GUI.color.a = weight;
    
    //Top Bar
    GUI.Box(Rect(0,0, Screen.width, Screen.height/16), "");
    
    GUILayout.BeginArea(Rect(0, 2, Screen.width, Screen.height/16 - 2));
    GUILayout.BeginHorizontal();
    GUILayout.FlexibleSpace();
    
    if (GUILayout.Button("Home", GUILayout.Width(Screen.width/12), GUILayout.ExpandHeight(true))) {
        window = MenuWindow.home;
        dropdown = Dropdown.none;
    }
    if (GUILayout.Button("Play", GUILayout.Width(Screen.width/12*2), GUILayout.ExpandHeight(true))) {
        if (dropdown != Dropdown.play) {
            dropdown = Dropdown.play;
        }
        else {
            dropdown = Dropdown.none;
        }
    }
    if (GUILayout.Button("Profile", GUILayout.Width(Screen.width/12*2), GUILayout.ExpandHeight(true))) {
        if (dropdown != Dropdown.profile) {
            dropdown = Dropdown.profile;
        }
        else {
            dropdown = Dropdown.none;
        }
    }
    if (GUILayout.Button("Options", GUILayout.Width(Screen.width/12*2), GUILayout.ExpandHeight(true))) {
      	if (dropdown != Dropdown.options) {
            dropdown = Dropdown.options;
        }
        else {
            dropdown = Dropdown.none;
        }      
       
    }
    if (GUILayout.Button("Quit", GUILayout.Width(Screen.width/12), GUILayout.ExpandHeight(true))) {
        if (dropdown != Dropdown.quit) {
            dropdown = Dropdown.quit;
        }
        else {
            dropdown = Dropdown.none;
        }
    }
    
    GUILayout.FlexibleSpace();
    GUILayout.EndHorizontal();
    GUILayout.EndArea();
    
    //Bottom Bar
    //rank, exp, kills, button, casualties, war direction
    //
    GUI.Box(Rect(0, sheight/10*9, swidth, sheight/10), "");
    
    if (GUI.Button(Rect(swidth/10*4, sheight/20*17, swidth/10*2, swidth/20*3), "Swap")) {
        //swap team view
    }
    
    //left side
    
    //right side
    GUI.Label(Rect(swidth/10*6, sheight/10*9, swidth/10, sheight/10), "" + Stats.totalCasulties);
    
    GUI.Box(Rect(swidth/10*7, sheight/30*28, swidth/10, sheight/30), "");
    GUI.color = NetworkManagerPrefab.BlueColor;
    GUI.Box(Rect(swidth/10*7, sheight/30*28, swidth/10*(Stats.t1Kills/(Stats.totalKills + 0.1)), sheight/30), "");
    GUI.color = NetworkManagerPrefab.GreenColor;
    GUI.Box(Rect(swidth/10*7 + swidth/10*(Stats.t1Kills/(Stats.totalKills + 0.1)), sheight/30*28, swidth/10*(Stats.t2Kills/(Stats.totalKills  + 0.1)), sheight/30), "");
    
    GUI.color = Color.white;
}

function QuickMatchScreen(weight:float) {
}

function ServerListScreen(weight:float) {
    GUI.color.a = weight;
    
    GUI.Box(Rect(windowOffset.x, windowOffset.y, swidth, sheight), "");
    GUI.BeginGroup(Rect(windowOffset.x, windowOffset.y, swidth, sheight));
    
    GUI.Label(Rect(0, 0, swidth, sheight/20), "Sever List");
    
    GUI.skin.box.fontSize = fontSize - 4;
    GUI.skin.label.fontSize = fontSize - 4;
    
    //Draw server list
    GUI.Box(Rect(0, sheight/20, swidth/7*3, sheight/20), "Name");
    GUI.Box(Rect(swidth/7*3, sheight/20, swidth/7, sheight/20), "Map");
    GUI.Box(Rect(swidth/7*4, sheight/20, swidth/7, sheight/20), "Mode");
    GUI.skin.box.fontSize -= 3;
    GUI.Box(Rect(swidth/7*5, sheight/20, swidth/7, sheight/20), "People");
    GUI.skin.box.fontSize += 3;
    GUI.Box(Rect(swidth/7*6, sheight/20, swidth/7, sheight/20), "Ping");
    
    hostList = MasterServer.PollHostList();
    GUI.BeginScrollView(Rect(0, sheight/20*2, swidth, sheight/20*17), Vector2.zero, Rect(0, 0, swidth, (hostList.length + 1)*sheight/20));
    for (IndexList = 0; IndexList < hostList.length; IndexList++) {
        host = hostList[IndexList];
        
        tmpFloat = GUI.skin.label.CalcHeight(GUIContent(host.gameName), swidth/7*3);
        
        if (GUI.Button(Rect(0, IndexList*sheight/20, swidth, tmpFloat), "")) {
            selectedServer = IndexList;
        }
		
        GUI.Label(Rect(0, IndexList*sheight/20, swidth/7*3, tmpFloat), host.gameName);
        comments = host.comment.Split(";"[0], 2);
        GUI.Label(Rect(swidth/7*3, IndexList*sheight/20, swidth/7, tmpFloat), comments[0]);
        GUI.Label(Rect(swidth/7*4, IndexList*sheight/20, swidth/7, tmpFloat), comments[1]);
        GUI.Label(Rect(swidth/5*5, IndexList*sheight/20, swidth/7, tmpFloat), host.connectedPlayers + "/" + host.playerLimit);
        GUI.Label(Rect(swidth/7*6, IndexList*sheight/20, swidth/7, tmpFloat), "9000");
	}
    GUI.EndScrollView();
    
    GUI.EndGroup();
    
    //Draw Side Menu
    windowOffset.x -= swidth/3*2;
    swidth = swidth/3*2;
    
    if (selectedServer >= 0 && selectedServer < hostList.length) {
        GUI.Box(Rect(windowOffset.x, windowOffset.y, swidth, sheight), "");
        GUI.BeginGroup(Rect(windowOffset.x, windowOffset.y, swidth, sheight));
        
        host = hostList[selectedServer];
        GUI.skin.box.fontSize = fontSize;
        GUI.Label(Rect(0, 0, swidth, sheight/20), host.gameName);
        GUI.skin.box.fontSize = fontSize - 4;
        
        comments = Split(host.comment, ";", 2);
        GUI.Label(Rect(0, sheight/20, swidth/3, sheight/20), comments[0]);
        GUI.Label(Rect(swidth/3, sheight/20, swidth/3, sheight/20), comments[1]);
        GUI.Label(Rect(swidth/3*2, sheight/20, swidth/3, sheight/20), host.connectedPlayers + "/" + host.playerLimit);
        
        GUI.Label(Rect(0, sheight/20*2, swidth, sheight/20*17), comments[2]);
        
        if (GUI.Button(Rect(0, sheight/20*19, swidth/2, sheight/20), "back")) {
            selectedServer = -1;
        }
        if (GUI.Button(Rect(swidth/2, sheight/20*19, swidth/2, sheight/20), "connect")) {
            Network.Connect(host);
			StartGame(false, true);
        }
        
        GUI.EndGroup();
    }
    
    GUI.skin.box.fontSize = fontSize;
    GUI.skin.label.fontSize = fontSize;
    
    GUI.color = Color.white;
}

function ServerEditScreen(weight:float) {
    GUI.color.a = weight;
    
    GUI.Box(Rect(windowOffset.x, windowOffset.y, swidth, sheight), "");
    GUILayout.BeginArea(Rect(windowOffset.x, windowOffset.y, swidth, sheight));
    
    GUILayout.Label("Host Server");
    
    GUI.skin.label.fontSize = fontSize - 4;
    
    GUILayout.BeginHorizontal();
    GUILayout.Label("Name");
    ServerSettings.serverName = GUILayout.TextField(ServerSettings.serverName, 24);
    GUILayout.EndHorizontal();
    
    GUILayout.BeginHorizontal();
    GUILayout.Label("Comment");
    ServerSettings.comment = GUILayout.TextArea(ServerSettings.comment, 64, GUILayout.Height(sheight/20*3));
    GUILayout.EndHorizontal();
    
    GUILayout.BeginHorizontal();
    GUILayout.Label("Map");
    ServerSettings.map = GUILayout.SelectionGrid(ServerSettings.map, ServerSettings.maps, 1);
    GUILayout.EndHorizontal();
    
    GUILayout.BeginHorizontal();
    GUILayout.Label("Mode");
    ServerSettings.gameMode = GUILayout.SelectionGrid(ServerSettings.gameMode, ServerSettings.gameModes, 2, GUILayout.ExpandHeight(false));
    GUILayout.EndHorizontal();
    
    GUILayout.BeginHorizontal();
    GUILayout.Label("Player Limit (" + ServerSettings.playerLimit + ")");
    ServerSettings.playerLimit = GUILayout.HorizontalSlider(ServerSettings.playerLimit, 1, 16);
    GUILayout.EndHorizontal();
    
    GUILayout.BeginHorizontal();
    GUILayout.Label("Target Kills (" + ServerSettings.targetKills + ")");
    ServerSettings.targetKills = GUILayout.HorizontalSlider(ServerSettings.targetKills, 10, 1000);
    GUILayout.EndHorizontal();
    
    GUILayout.FlexibleSpace();
    if (GUILayout.Button("Start Server")) {
        Network.InitializeServer(ServerSettings.playerLimit, 2000, true);
        MasterServer.RegisterHost("OutpostGameV" + Settings.version, ServerSettings.serverName, ServerSettings.map + ";" + ServerSettings.gameMode + ";" + ServerSettings.comment);
        ServerSettings.Save();
        StartGame(true, true);
    }
    GUILayout.BeginHorizontal();
    
    GUILayout.EndHorizontal();
    
    GUI.skin.label.fontSize = fontSize;
    
    GUILayout.EndArea();
    GUI.color = Color.white;
}

function ProfileScreen(weight:float) {
}


function OptionsScreen(weight:float) {
    GUI.color.a = weight;
    GUI.skin.box.fontSize = fontSize - 4;
    GUI.skin.label.fontSize = fontSize - 4;
    GUI.skin.button.fontSize = fontSize - 4;
    
    GUI.Box(Rect(windowOffset.x, windowOffset.y, swidth, sheight), "");
    
    
    GUILayout.BeginArea(Rect(windowOffset.x, windowOffset.y, swidth, sheight));
    
    optionsType = GUILayout.SelectionGrid(optionsType, ["Video",  "Controls"], 2, GUILayout.Height(Screen.height/18));
    
	if (optionsType == 0){
		ScrollPosition = GUILayout.BeginScrollView(ScrollPosition);
        
		GUILayout.BeginHorizontal();
        
		GUILayout.Label("Quality Level");
		GUILayout.FlexibleSpace();
		if (GUILayout.Button("<", GUILayout.Width(swidth/15))){
			VideoSettings.qualityLevel  = Mathf.Clamp(VideoSettings.qualityLevel - 1, 0, VideoSettings.qualityLevels.length - 1);
		}
		GUILayout.Label(VideoSettings.qualityLevels[VideoSettings.qualityLevel], GUILayout.Width(swidth/15*4));
		if (GUILayout.Button(">", GUILayout.Width(swidth/15))) {
			VideoSettings.qualityLevel  = Mathf.Clamp(VideoSettings.qualityLevel + 1, 0, VideoSettings.qualityLevels.length - 1);
		}
		GUILayout.EndHorizontal();
        
		GUILayout.Space(20);
        
		GUILayout.BeginHorizontal();
		GUILayout.Label("Screen Size");
		GUILayout.FlexibleSpace();
		if (GUILayout.Button("<", GUILayout.Width(swidth/15))) {
			VideoSettings.resolution  = Mathf.Clamp(VideoSettings.resolution - 1, 0, VideoSettings.resolutions.length - 1);
		}
		GUILayout.Label(VideoSettings.resolutions[VideoSettings.resolution].x + "x" + VideoSettings.resolutions[VideoSettings.resolution].y, GUILayout.Width(swidth/15*4));
		if (GUILayout.Button(">", GUILayout.Width(swidth/15))) {
			VideoSettings.resolution  = Mathf.Clamp(VideoSettings.resolution + 1, 0, VideoSettings.resolutions.length - 1);
		}
		GUILayout.EndHorizontal();
        
		GUILayout.Space(20);
        
		GUILayout.BeginHorizontal();
		GUILayout.Label("Fullscreen");
		GUILayout.FlexibleSpace();
        if (VideoSettings.fullScreen) {
            if (GUILayout.SelectionGrid(1, ["Off",  "On"], 2, GUILayout.Width(swidth/15*6)) == 0) {
                VideoSettings.fullScreen = false;
            }
        }
        else {
            if (GUILayout.SelectionGrid(0, ["Off", "On"], 2, GUILayout.Width(swidth/15*6)) == 1) {
                VideoSettings.fullScreen = true;
            }
        }
		GUILayout.EndHorizontal();
        
		GUILayout.Space(20);
		
        GUILayout.BeginHorizontal();
		GUILayout.Label("Texture Quality");
		GUILayout.FlexibleSpace();
		if (GUILayout.Button("<", GUILayout.Width(swidth/15))) {
			VideoSettings.textureMipMapLevel  = Mathf.Clamp(VideoSettings.textureMipMapLevel + 1, 0, 3);
		}
		GUILayout.Label(VideoSettings.textureMipMaps[VideoSettings.textureMipMapLevel], GUILayout.Width(swidth/15*4));
		if (GUILayout.Button(">", GUILayout.Width(swidth/15))) {
			VideoSettings.textureMipMapLevel  = Mathf.Clamp(VideoSettings.textureMipMapLevel - 1, 0, VideoSettings.textureMipMaps.length - 1);
		}
		GUILayout.EndHorizontal();
        
		GUILayout.Space(20);
		
        GUILayout.BeginHorizontal();
		GUILayout.Label("Shadow Distance");
		GUILayout.FlexibleSpace();
		GUILayout.Label(parseInt(VideoSettings.shadowDistance) + "");
		VideoSettings.shadowDistance = GUILayout.HorizontalSlider(VideoSettings.shadowDistance, 0, 80, GUILayout.Width(swidth/10*4));
		GUILayout.EndHorizontal();
		GUILayout.Space(20);
		
		GUILayout.BeginHorizontal();
		GUILayout.Label("Volume");
		GUILayout.FlexibleSpace();
		GUILayout.Label(parseInt(SoundSettings.volume * 100) + "");
		SoundSettings.volume = GUILayout.HorizontalSlider(SoundSettings.volume, 0.0, 1.0, GUILayout.Width(swidth/10*4));
		GUILayout.EndHorizontal();
        
		GUILayout.Space(20);
		
		GUILayout.BeginHorizontal();
		GUILayout.Label("Sensitivity");
		GUILayout.FlexibleSpace();
		GUILayout.Label(parseInt(Controls.Sensitivity)/5 + "");
		Controls.Sensitivity = GUILayout.HorizontalSlider(Controls.Sensitivity, 0.0, 500, GUILayout.Width(swidth/10*4));
		GUILayout.EndHorizontal();
		GUILayout.Space(20);
		
		GUILayout.BeginHorizontal();
		GUILayout.Label("Anti Aliasing");
		GUILayout.FlexibleSpace();
		if (GUILayout.Button("<", GUILayout.Width(swidth/15))) {
			VideoSettings.antiAliasing = Mathf.Clamp(VideoSettings.antiAliasing - 1, 0, VideoSettings.antiAliasings.length - 1);
		}
		if (VideoSettings.antiAliasings[VideoSettings.antiAliasing] != 0){
			GUILayout.Label(VideoSettings.antiAliasings[VideoSettings.antiAliasing] + "x", GUILayout.Width(swidth/15*4));
		}
		else{
			GUILayout.Label("Disabled", GUILayout.Width(swidth/15*4));
		}
		if (GUILayout.Button(">", GUILayout.Width(swidth/15))) {
			VideoSettings.antiAliasing = Mathf.Clamp(VideoSettings.antiAliasing + 1, 0, VideoSettings.antiAliasings.length - 1);
		}
		GUILayout.EndHorizontal();
        
        
		GUILayout.EndScrollView();
	}
	else {
		ScrollPosition = GUILayout.BeginScrollView(ScrollPosition);
		
		Controls.jump = KeyField(Controls.jump, "Jump");
		
		GUILayout.Space(20);
		
		Controls.crouch = KeyField(Controls.crouch, "Crouch");
		
		GUILayout.Space(20);
		
		Controls.sprint = KeyField(Controls.sprint, "Sprint");
		
		GUILayout.Space(20);
		
		Controls.action = KeyField(Controls.action, "Action");
		
		GUILayout.Space(20);
		
		Controls.stp = KeyField(Controls.stp, "Primary Weapon");
		
		GUILayout.Space(20);
		
		Controls.sts = KeyField(Controls.sts, "Secondary Weapon");
		
		GUILayout.Space(20);
		
		Controls.quickswap = KeyField(Controls.quickswap, "Quick Swap");
        
        GUILayout.Space(20);
		
		Controls.reload = KeyField(Controls.reload, "Reload");
		
		GUILayout.Space(20);
		
		Controls.grenade = KeyField(Controls.grenade, "Grenade");
		
		GUILayout.Space(20);
		
		Controls.chat = KeyField(Controls.chat, "Global Chat");
		
		GUILayout.Space(20);
		
		Controls.fire = KeyField(Controls.fire, "Fire");
		
		GUILayout.Space(20);
		
		Controls.aim = KeyField(Controls.aim, "Aim");
		
		GUILayout.EndScrollView();
	}
    
    
    GUILayout.BeginHorizontal();
    if (GUILayout.Button("Save")) {
        VideoSettings.Save();
        VideoSettings.Apply();
        SoundSettings.Save();
        SoundSettings.Apply();
        Controls.Save();
        window = MenuWindow.home;
    }
    if (GUILayout.Button("Exit")) {
        VideoSettings.Load();
        SoundSettings.Load();
        Controls.Load();
        window = MenuWindow.home;
    }
    if (GUILayout.Button("Reset")) {
        Controls.Reset();
    }
    GUILayout.EndHorizontal();
    
    GUILayout.EndArea();
    
    GUI.skin.box.fontSize = fontSize;
    GUI.skin.label.fontSize = fontSize;
    GUI.skin.button.fontSize = fontSize;
    GUI.color = Color.white;
    
}
function KeyField(key:KeyCode, name:String) {
	GUILayout.BeginHorizontal();
	GUILayout.Label(name);
	GUILayout.FlexibleSpace();
	if(GUILayout.Button("" + key, GUILayout.Width(swidth/10*4)) && !Detect) {
		key = KeyCode.None;
		Detect = true;
	}
	else if (Detect && key == KeyCode.None) {
		key = Controls.AssignKey(key);
		if (key != KeyCode.None) {
			Detect = false;
		}
	}
	GUILayout.EndHorizontal();
	return key;
}

function HomeScreen(weight:float) {
}

function StartGame(server:boolean, client:boolean) {
	var networkManager:NetworkManager = Instantiate(NetworkManagerPrefab, Vector3.zero, Quaternion.identity);
	DontDestroyOnLoad(networkManager);
    
    //Load Mod
    Settings.LoadMod("Default");
    Settings.mod.Set("gameMode", ServerSettings.gameMode);
    Settings.mod.Set("map", ServerSettings.map);
    Settings.mod.Set("targetKills", ServerSettings.targetKills);
    Settings.mod.Set("startTime", ServerSettings.startTime);
    Settings.mod.Set("respawnTime", ServerSettings.respawnTime);
    Settings.mod.Set("deathTime", ServerSettings.deathTime);
    Settings.mod.Set("winTime", ServerSettings.winTime);
    Settings.mod.Set("postTime", ServerSettings.postTime);
	
	networkManager.gameObject.AddComponent(NetworkServer);
	networkManager.gameObject.AddComponent(NetworkClient);
	
	if (!client) {
		networkManager.GetComponent(NetworkClient).enabled = false;
	}
	if (!server) {
		networkManager.GetComponent(NetworkServer).enabled = false;
	}
	
	Application.LoadLevel(1);
}

function Split(str:String, position:String, maxNumber:int):String[] {
    var list:String[] = str.Split([position] as String[], StringSplitOptions.None);
    var out:String[] = new String[maxNumber + 1];
    for (var i:int = 0; i < list.length; i++) {
        if (i >= maxNumber) {
            out[maxNumber] += list[i];
            if (i < list.length - 1) {
                out[maxNumber] += position;
            }
        }
        else {
            out[i] = list[i];
        }
    }
    return out;
}

/*
function CreditsWindow() {
	if (GUILayout.Button("Close")) {
		Window = 0;
	}
    
	GUILayout.BeginArea(Rect(Screen.width/20, Screen.height/10, Screen.width/20*18, Screen.height/20*19));
	GUILayout.Label("Main Team:");
	GUILayout.Space(10);
	GUILayout.Label("Lead Programmer, 3D Artist and Designer");
	GUILayout.Label("Benjamin Schaaf");
	GUILayout.Space(10);
	GUILayout.Label("Lead Designer, 3D Artist and Programmer");
	GUILayout.Label("Cameron Lonsdale");
    GUILayout.Space(10);
    GUILayout.Label("3D Artist and Designer");
    GUILayout.Label("Dean Gouskos");
	GUILayout.Space(20);
	GUILayout.Label("Contributors:");
	GUILayout.Space(10);
	GUILayout.Label("Tobias ******");
	GUILayout.Space(20);
	GUILayout.Space(20);
	GUILayout.Label("© 2012 Outpost Software. All rights reserved. Outpost Software, the Outpost Software logos and the Outpost game itself and included content are copyrighted under the Australian copyright law; the Copyright Act 1968. All other creative material is property of its respective owners.");
	GUILayout.Space(20);
	GUILayout.Label("Outpost Software makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties, including without limitation, implied warranties or conditions of merchantability  or other violation of rights. In no event shall Outpost Software be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising from the use or inability to use the software and games produced by Outpost Software, even if Outpost Software or an Outpost Software authorized representative has been notified orally or in writing of the possibility of such damage.");
	GUILayout.Space(20);
	GUILayout.Label("By installing, using or accessing the Software or Services you are considered to have accepted the terms set out in this document. If you do not agree with or otherwise wish to accept the terms set out in this document, do not install, use or access the Software and/or the Services.");
	GUILayout.EndArea();
}
*/