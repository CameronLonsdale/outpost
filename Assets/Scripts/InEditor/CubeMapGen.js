#pragma strict

var Cam:Camera;
var path:String;
private var State:int = -1;

function Awake() {
	Cam.depth = 9999999;
	Cam.fieldOfView = 90;
	path = "Assets/" + path;
}

function Update() {
	if (State == 0) {
		Cam.transform.eulerAngles = Vector3(0, 0, 0);
		Application.CaptureScreenshot(path + "S1.png", 1);
	}
	else if (State == 1) {
		Cam.transform.eulerAngles = Vector3(90, 0, 0);
		Application.CaptureScreenshot(path + "S2.png", 1);
	}
	else if (State == 2) {
		Cam.transform.eulerAngles = Vector3(-90, 0, 0);
		Application.CaptureScreenshot(path + "S3.png", 1);
	}
	else if (State == 3) {
		Cam.transform.eulerAngles = Vector3(0, 90, 0);
		Application.CaptureScreenshot(path + "S4.png", 1);
	}
	else if (State == 4) {
		Cam.transform.eulerAngles = Vector3(0, 180, 0);
		Application.CaptureScreenshot(path + "S5.png", 1);
	}
	else if (State == 5) {
		Cam.transform.eulerAngles = Vector3(0, 270, 0);
		Application.CaptureScreenshot(path + "S6.png", 1);
	}
	else if (State == 6) {
		Destroy(this);
	}
	State += 1;
}