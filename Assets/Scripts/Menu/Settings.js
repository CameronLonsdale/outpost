#pragma strict
#pragma downcast

import System.IO;
import System.Reflection;
import System.CodeDom.Compiler;
import System.Text;
import System;
import System.Linq;

/*
=====================================================================================================================
GLOBALS
=====================================================================================================================
*/

static class Settings {
    function get backend():String {
        if (devMode) {
            return "https://127.0.0.1:3000";
        }
        return "https://api.outpostsoftware.com";
    }
    var offline:boolean = false;
    var _upToDate:boolean = false;
    function get upToDate():boolean {
        return _upToDate || devMode;
    }
    function set upToDate(value:boolean) {
        _upToDate = value;
    }

    function get loggedIn():boolean {
        return (((AccountSettings.secureCode != "" && AccountSettings.ticket != "") || offline) && upToDate);
    }

    function get devMode():boolean {
        return true;
    }
    
    function get version():String {
        return "0.26";
    }
}

static class Stats {
    var totalCasulties:long;
    var t1Kills:long;
    var t2Kills:long;
    
    function get totalKills():long {
        return t1Kills + t2Kills;
    }
}

/*
=====================================================================================================================
SETTINGS
=====================================================================================================================
*/

static class NetworkSettings {
    var disconnectMessage:String = "";
    var showDisconnectMessage:boolean = false;
}

static class Controls {
	var Sensitivity:float = 100;
	
	var jump:KeyCode = KeyCode.Space;
	var sprint:KeyCode = KeyCode.LeftShift;
	var crouch:KeyCode = KeyCode.LeftControl;
	var action:KeyCode = KeyCode.E;
	var stp:KeyCode = KeyCode.Alpha1;
	var sts:KeyCode = KeyCode.Alpha2;
	var quickswap:KeyCode = KeyCode.Q;
	var grenade:KeyCode = KeyCode.G;
	var reload:KeyCode = KeyCode.R;
	var chat:KeyCode = KeyCode.T;
	var fire:KeyCode = KeyCode.Mouse0;
	var aim:KeyCode = KeyCode.Mouse1;
	
	var normalSprint:int = 0;
	var autoLadderJump:int = 0;
	
	function Save() {
		ObjectSaver.Save("Settings" + Path.DirectorySeparatorChar + "controls.conf", Controls);
	}
	
	function Load() {
		if (File.Exists("Settings" + Path.DirectorySeparatorChar + "controls.conf")) {
			ObjectSaver.Load("Settings" + Path.DirectorySeparatorChar + "controls.conf", Controls);
		}
		else {
			Save();
		}
	}
	
	function Reset() {
		Sensitivity = 100;
		
		jump = KeyCode.Space;
		sprint = KeyCode.LeftShift;
		crouch = KeyCode.LeftControl;
		action = KeyCode.E;
		stp = KeyCode.Alpha1;
		sts = KeyCode.Alpha2;
		quickswap = KeyCode.Q;
		grenade = KeyCode.G;
		reload = KeyCode.R;
		chat = KeyCode.T;
		fire = KeyCode.Mouse0;
		aim = KeyCode.Mouse1;
        
        normalSprint = 0;
	}
	
	function AssignKey(key:KeyCode) {
		if (key == KeyCode.None){
			key = GetAnyKey();
			if (key != KeyCode.None) {
				if (!CheckDoubles(key)) {
					key = KeyCode.None;
				}
			}
		}
		return key;
	}
	
	function GetAnyKey() {
		var tmp:KeyCode;
		
		for (tmp in KeyCode.GetValues(KeyCode)) {
			if (Input.GetKeyDown(tmp)) {
				return tmp;
			}
		}
		return KeyCode.None;
	}
	
	function CheckDoubles(key:KeyCode) {
		if ("" + key == "" + jump || "" + key == "" + sprint || "" + key == "" + crouch || "" + key == "" + action) {
			return false;
		}
		if ("" + key == "" + reload || "" + key == "" + chat || "" + key == "" + fire || "" + key == "" + aim) {
			return false;
		}
		if ("" + key == "" + stp || "" + key == "" + sts || "" + key == "" + quickswap || "" + key == "" + grenade) {
			return false;
		}
		return true;
	}
}

static class VideoSettings {
	var fullScreen:boolean = false;
	
	var resolutions:Vector2[] = [
		Vector2(854, 480),
		Vector2(960, 540),
		Vector2(1024, 720),
		Vector2(1366, 768),
		Vector2(1600, 900),
		Vector2(1920, 1080),
		Vector2(2048, 1152),
		Vector2(2560, 1440)
	];
	var resolution:int = 0;
	
	var qualityLevels:String[] = [
		"Miss",
		"Normal",
		"Mini-Crit",
		"Crit",
		"Uber-Crit",
		"Instakill"
	];
	var qualityLevel:int = 5;
	
	var shadowDistance:float = 20;
	
	var antiAliasings:int[] = [
		0,
		2,
		4,
		8
	];
	var antiAliasing:int = 0;
	
	var vSyncs:String[] = [
		"Don't Sync",
		"Single Buffer",
		"Double Buffer"
	];
	
	var vSync:int = 0;
	
	var anisotropicFiltering:AnisotropicFiltering = AnisotropicFiltering.Disable;
	
	
	var textureMipMaps:String[] = [
		"Full",
		"Half",
		"Quater"
	];
	var textureMipMapLevel:int = 0;
	
	function Apply() {
		//Set resolution
		Screen.SetResolution(resolutions[resolution].x,  resolutions[resolution].y, fullScreen);
		
		//Set overall quality level
		QualitySettings.SetQualityLevel(qualityLevel);
		//Set individual quality levels
		QualitySettings.shadowDistance = shadowDistance;
		QualitySettings.antiAliasing = antiAliasing;
		QualitySettings.vSyncCount = vSync;
		QualitySettings.anisotropicFiltering = anisotropicFiltering;
		QualitySettings.masterTextureLimit = textureMipMapLevel;
	}
	
	function Save() {
		ObjectSaver.Save("Settings" + Path.DirectorySeparatorChar + "video.conf", VideoSettings);
	}
	
	function Load() {
		if (File.Exists("Settings" + Path.DirectorySeparatorChar + "video.conf")) {
			ObjectSaver.Load("Settings" + Path.DirectorySeparatorChar + "video.conf", VideoSettings);
		}
		else {
			Save();
		}
	}
}

static class SoundSettings {
	var speakerMode:AudioSpeakerMode = AudioSpeakerMode.Stereo;
	var volume:float = 0.5;
	
	function Apply() {
		AudioSettings.speakerMode = speakerMode;
		AudioListener.volume = Mathf.Clamp01(volume);
	}
	
	function Save() {
		ObjectSaver.Save("Settings" + Path.DirectorySeparatorChar + "audio.conf", SoundSettings);
	}
	
	function Load() {
		if (File.Exists("Settings" + Path.DirectorySeparatorChar + "audio.conf")) {
			ObjectSaver.Load("Settings" + Path.DirectorySeparatorChar + "audio.conf", SoundSettings);
		}
		else {
			Save();
		}
	}
}

static class ServerSettings {
    var serverName:String = "Default Server Name";
    var comment:String = "No-comment";
    
    var playerLimit:int = 10;
    
    var maps:String[] = [
        "Op Downtown"
    ];
    
	var map:int = 0;
    
    var gameModes:String[] = [
        "TDM",
        "KOTH"
    ];
    
	var gameMode:int = 0;
	
	//Timings
	var startTime:float = 0;
	var respawnTime:float = 5;
	
	var deathTime:float = 3;
	
	var winTime:float = 8;
    
    var postTime:float = 2;
	
	//Other
	var targetKills:int = 100;
	
	function Save() {
		ObjectSaver.Save("Settings" + Path.DirectorySeparatorChar + "server.conf", ServerSettings, false);
	}
	
	function Load() {
		if (File.Exists("Settings" + Path.DirectorySeparatorChar + "server.conf")) {
			ObjectSaver.Load("Settings" + Path.DirectorySeparatorChar + "server.conf", ServerSettings);
		}
		else {
			Save();
		}
	}
}

static class AccountSettings {
	var username:String = "";
    
    var savePassword:boolean = false;
    var passwordEncoded:byte[] = new byte[0];
    function get password():String {
        return Encoding.UTF8.GetString(passwordEncoded);
    }
    function set password(value:String) {
        passwordEncoded = Encoding.UTF8.GetBytes(value);
    }
    
    private var _ticket:String = "";
    function get ticket():String {
        return _ticket;
    }
    function set ticket(value:String) {
        _ticket = value;
    }
    
    private var _secureCode:String = "";
    function get secureCode():String {
        return _secureCode;
    }
    function set secureCode(value:String) {
        _secureCode = value;
    }
	
	function Save() {
		ObjectSaver.Save("Settings" + Path.DirectorySeparatorChar + "account.conf", AccountSettings, savePassword);
	}
	
	function Load() {
		if (File.Exists("Settings" + Path.DirectorySeparatorChar + "account.conf")) {
			ObjectSaver.Load("Settings" + Path.DirectorySeparatorChar + "account.conf", AccountSettings);
		}
		else {
			Save();
		}
	}
    
    function Reset() {
        username = "";
        password = "";
        ticket = "";
        secureCode = "";
    }
}

static class Loadout {
    var selectedMain:int = 0;
    var selectedSecondary:int;
    var selectedMainClass:GunClassMain = GunClassMain.All;
    var selectedSecondaryClass:GunClassSecondary = GunClassSecondary.All;
    var selectedGrenade:int = 0;
    
    var loadoutsMain:int[];
    var loadoutsSecondary:int[];
    
    var gunsMain:Gun[];
    var gunsSecondary:Gun[];
    
    private function GetLoadouts() {
        //get loadout lists
        var i:int = 0;
        
        loadoutsMain = new int[gunsMain.length*3];
        
        for (i = 0; i < gunsMain.length; i++) {
            loadoutsMain[i*3] = gunsMain[i].Addons[0];
            loadoutsMain[i*3 + 1] = gunsMain[i].Addons[1];
            loadoutsMain[i*3 + 2] = gunsMain[i].Addons[2];
        }
        
        loadoutsSecondary = new int[gunsSecondary.length*3];
        
        for (i = 0; i < gunsSecondary.length; i++) {
            loadoutsSecondary[i*3] = gunsSecondary[i].Addons[0];
            loadoutsSecondary[i*3 + 1] = gunsSecondary[i].Addons[1];
            loadoutsSecondary[i*3 + 2] = gunsSecondary[i].Addons[2];
        }
    }
    
    private function SetLoadouts() {
        //set loadout lists
        var i:int = 0;
        if (loadoutsMain) {
            for (i = 0; i < gunsMain.length; i++) {
                if (loadoutsMain.length > i*3 + 2) {
                    gunsMain[i].Addons[0] = loadoutsMain[i*3];
                    gunsMain[i].Addons[1] = loadoutsMain[i*3 + 1];
                    gunsMain[i].Addons[2] = loadoutsMain[i*3 + 2];
                }
            }
        }
        
        if (loadoutsSecondary) {
            for (i = 0; i < gunsSecondary.length; i++) {
                if (loadoutsSecondary.length > i*3 + 2) {
                    gunsSecondary[i].Addons[0] = loadoutsSecondary[i*3];
                    gunsSecondary[i].Addons[1] = loadoutsSecondary[i*3 + 1];
                    gunsSecondary[i].Addons[2] = loadoutsSecondary[i*3 + 2];
                }
            }
        }
    }
    
    function Save() {
        GetLoadouts();
        ObjectSaver.Save("Settings" + Path.DirectorySeparatorChar + "loadout.conf", Loadout, true);
    }
    
    function Load() {
        if (File.Exists("Settings" + Path.DirectorySeparatorChar + "loadout.conf")) {
			ObjectSaver.Load("Settings" + Path.DirectorySeparatorChar + "loadout.conf", Loadout);
            SetLoadouts();
		}
		else {
			Save();
		}
    }
}

//Saves/Loads public variables from a static class
static class ObjectSaver {
    function Save(path:String, T:Type) {Save(path, T, false);}
	function Save(path:String, T:Type, advancedTypes:boolean) {
		var fields:FieldInfo[] = T.GetFields(BindingFlags.Public | BindingFlags.Static);
		
		var lines:String = "";
		for (var field:FieldInfo in fields) {
			if (IsSupported(field.FieldType, advancedTypes)) {
				lines += field.Name + " : " + ToString(field.GetValue(null)) + "\n";
			}
		}
		
		Directory.CreateDirectory(Path.GetDirectoryName(path));
		File.WriteAllText(path, lines);
	}
	
	function Load(path:String, T:Type) {
		var lines:String[] = File.ReadAllLines(path);
		for (var line:String in lines) {
            var split:String[] = line.Split([" : "] as String[], 2, StringSplitOptions.RemoveEmptyEntries);
            
            if (split.length == 2) {
                var field:FieldInfo = T.GetField(split[0]);
                
                if (field) {
                    var obj:Object = FromString(field.FieldType, split[1]);
                    
                    field.SetValue(null, obj);
                }
            }
		}
	}
	
	private function IsSupported(T:Type, advancedTypes:boolean):boolean {
        if (T == int || T == float || T == String || T == boolean || 
            (T == typeof(byte[]) && advancedTypes) || T.IsEnum || 
            (T.IsArray && advancedTypes && IsSupported(T.GetElementType(), false))) {
            return true;
        }
		return false;
	}
	
	private function ToString(value:Object):String {
        var T:Type = value.GetType();
        if (T == int || T == float || T == String || T == boolean || T.IsEnum) {
            return "" + value;
        }
        else if (T == typeof(byte[])) {
            return "" + Convert.ToBase64String(value);
        }
        else if (T.IsArray) {
            var out:String = "";
            for (var obj:Object in value) {
                out += ToString(obj) + "~";
            }
            return out.Remove(out.length - 1) + "";
        }
        return "";
	}
    
    private function FromString(type:Type, value:String):Object {
        if (type == int) {
            return parseInt(value);
        }
        else if (type == float) {
            return parseFloat(value);
        }
        else if (type == String) {
            return value;
        }
        else if (type == boolean) {
            return boolean.Parse(value);
        }
        else if (type == typeof(byte[])) {
            return Convert.FromBase64String(value);
        }
        else if (type.IsEnum) {
            return System.Enum.Parse(type, value);
        }
        else if (type.IsArray) {
            var objects:String[] = value.Split("~"[0]);
            var out:Object[] = new Object[objects.length];
            for (var i:int = 0; i < objects.length; i++) {
                out[i] = FromString(type.GetElementType(), objects[i]);
            }
            if (type == typeof(int[])) {
                return out.OfType.<int>().ToArray();
            }
            else if (type == typeof(float[])) {
                return out.OfType.<float>().ToArray();
            }
            else if (type == typeof(boolean[])) {
                return out.OfType.<boolean>().ToArray();
            }
        }
        return "";
    }
}

/*
=====================================================================================================================
MODDING
=====================================================================================================================
*/

static var defaultMod:TextAsset;

static function GetGameMode(map:int):int[] {
    if (map == 0) {
        return [0, 1, 3];
    }
    return null;
}

static var mod:Mod = null;

static function LoadMod(name:String) {
    if (name == "Default") {
        mod = new Mod(new Default());
    }
    else {
        if (!File.Exists("Mods" + Path.DirectorySeparatorChar + name + ".dll")) {
            Directory.CreateDirectory("Mods");
            File.WriteAllBytes("Mods" + Path.DirectorySeparatorChar + "Default.dll", defaultMod.bytes);
            name = "Default";
        }
        mod = new Mod("Mods" + Path.DirectorySeparatorChar + name + ".dll");
    }
}

//Mod class
class Mod {
	//the instance of the assembly and it's respective type
	var assembly:Assembly;
	var instance:Object;
	private var _type:Type;
	
	//instance attributes for easy access
	private var methods:Dictionary.<String, MethodInfo>;
    private var fields:Dictionary.<String, FieldInfo>;
	
	//errors while loading a Mod
	var errors:String[];
	
	/*---
	PROPERTIES
	---*/
	
	function get type():Type {
		return _type;
	}
	
	/*---
	CONSTRUCTORS
	---*/
	
	//Create a new instance of Mod (load a C# file at runtime)
	function Mod(path:String) {
		errors = new String[0];
		
		//check for path related errors
		if (CheckPath(path)) {
			return;
		}
		
		//Load/compile the assembly from the path
		assembly = LoadAssembly(path);
		
		//if the assembly has errors we stop
		if (assembly == null) {
			return;
		} 
		
		//Create a new instance from the assembly with the same name as the file
		instance = assembly.CreateInstance(Path.GetFileNameWithoutExtension(path), true);
		
		//if there was an error creating the instance we add it to the error list and stop
		if (instance == null) {
			AddError("No class in <'" + Path.GetFileName(path) + "'> matches the file name <'" + Path.GetFileNameWithoutExtension(path) + "'>");
			return;
		}
		
		//get the type of our instance
		_type = instance.GetType();
		
		//Store all the methods of the instance in a Hashtable for easy access
		methods = new Dictionary.<String, MethodInfo>();
		for (var info:MethodInfo in _type.GetMethods()) {
			methods[info.Name] = info;
		}
        
        //Store all the methods of the instance in a Hashtable for easy access
		fields = new Dictionary.<String, FieldInfo>();
		for (var info:FieldInfo in _type.GetFields()) {
			fields[info.Name] = info;
		}
	}
    
    function Mod(obj:Object) {
        //Create a new instance from the assembly with the same name as the file
		instance = obj;
		
		//get the type of our instance
		_type = instance.GetType();
		
		//Store all the methods of the instance in a Hashtable for easy access
		methods = new Dictionary.<String, MethodInfo>();
		for (var info:MethodInfo in _type.GetMethods()) {
			methods[info.Name] = info;
		}
        
        //Store all the methods of the instance in a Hashtable for easy access
		fields = new Dictionary.<String, FieldInfo>();
		for (var info:FieldInfo in _type.GetFields()) {
			fields[info.Name] = info;
		}
    }
	
	//Check if the file exists at the path
	//And wether the path links to a C# file
	//Add errors when nessecary
	private function CheckPath(path:String):boolean {
		if (File.Exists(path)) {
			if (Path.GetExtension(path) == ".dll") {
				return false;
			}
			else {
				AddError("File <'" + Path.GetFileName(path) +"'> is not of the right type <'.dll'>");
			}
		}
		else {
			AddError("File <'" + Path.GetFileName(path) +"'> does not exist");
		}
		return true;
	}
	
	//.Add function for static length list
	//negates having errors be dynamic
	private function AddError(name:String) {
		var new_errors:String[] = new String[errors.length + 1];
		
		for (var i:int = 0; i < errors.length; i++) {
			new_errors[i] = errors[i];
		}
		
		new_errors[new_errors.length - 1] = name;
		errors = new_errors;
	}
	
	//Load an assembly from file
	private function LoadAssembly(path:String):Assembly {
		return Assembly.LoadFile(path);
		/*
		//Set compiler parameters
		var params:CompilerParameters = new CompilerParameters();
		params.GenerateExecutable = false; //Don't make executable
	    params.GenerateInMemory = false; //Don't save the dll
	    //params.ReferencedAssemblies.Add("System.dll"); //Allow access to System namespaces
	    
	    //create C# provider and compile assembly
        var extention:String = Path.GetExtension(path);
        if (extention == ".cs") {
            extention = "CSharp";
        }
        else if (extention == ".js") {
            extention = "JScript";
        }
        
	    var provider:CodeDomProvider = new CodeDomProvider.CreateProvider("CSharp");
	    var results:CompilerResults = provider.CompileAssemblyFromFile(params, path);
	    
	    //On compiler errors dump them to file
	    //return null on errors
	    if (results.Errors.HasErrors) {
	        DumpCompilerErrors(results.Errors, path);
	        AddError("Compiler errors found in <'" + Path.GetFileName(path) + "'>. errors dumped.");
	        return null;
	    }
	    else {
	    	//return the compiler assembly
	        return results.CompiledAssembly;
	    }
	    */
	}
	
	//dump a list of errors to dump.txt in same directory
	private function DumpCompilerErrors(errors:CompilerErrorCollection, path:String) {
		//Put errors into list for writing
		var lines:String[] = new String[errors.Count];
		for (var i:int = 0; i < errors.Count; i++) {
			//Put errors in the same format as they are in the Unity Editor
			lines[i] = errors[i].FileName + "(" + errors[i].Line + ", " + errors[i].Column + "): " + errors[i].ErrorText;
		}
		
		//Dump error to disc in same directory as the original file
		path = Path.GetDirectoryName(path) + Path.DirectorySeparatorChar + "dump.txt";
		File.WriteAllLines(path, lines);
	}
	
	/*---
	INSTANCE FUNCTIONS
	---*/
	
	//Invoke a method by 'name' and return it's value
	function Invoke(name:String):Object {
        if (name in methods) {
            return methods[name].Invoke(instance, new Object[0]);
        }
        return null;
	}
    
    //Check if the mod has 'name' method
    function HasMethod(name:String):boolean {
        return (name in methods);
    }
    
    function HasField(name:String):boolean {
        return (name in fields);
    }
    
    function Get(name:String):Object {
        if (name in fields) {
            return fields[name].GetValue(instance);
        }
        return null;
    }
    
    function Set(name:String, value:Object):void {
        if (name in fields) {
            fields[name].SetValue(instance, value);
        }
    }
    
    static var DefaultScript:TextAsset;
}