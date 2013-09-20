#pragma strict

class Helicopter extends VehicleInstance {

function get hasDriver():boolean {
	return vehicle.Slots[0] != null;
}

//References
private var controller:VehicleController;
private var controllerOffset:Vector3;
var Body:Transform;
var Canon:Transform;

var MinigunGun:Gun;
var CanonGun:Gun;

var DownForce:float;
var DragForce:float;
var TurnSpeed:float;
var Acceleration:Vector2;
var MaxVelocity:Vector2;
private var movement:Vector3;
var MaxRotation:float;

private var vehicleHit:RaycastHit;

//Camera Settings
var DriverViewDistance:float;

//weapon system
private var CanonFireTimer:float;
private var MinigunFireTimer:float;

private var prjt:Projectile;

private var tmpFloat:float;
private var tmpQuat:Quaternion;

function Start() {
	transform.position.z = 0;
	
	controller = GetComponent(typeof(VehicleController)) as VehicleController;
}

function Move(slot:int, input:InputState, deltaTime:float):VehicleState {
	MoveCopyStates(slot);
	
	if (slot == 0) {
		//Move
		movement = Vector3.zero;
		movement.x = (input.horizontal*Acceleration.x + -DragForce*Mathf.Pow(currentStates[0].velocity.x, 2))*deltaTime;
		movement.y = (-input.vertical*Acceleration.y - DownForce + -DragForce*Mathf.Pow(currentStates[0].velocity.y, 2))*deltaTime;
		
		currentStates[0].velocity += movement*deltaTime;
		ClampVelocity(0);
		
		vehicleHit = new RaycastHit();
		vehicleHit.distance = 0;
		controller.Move(currentStates[0].velocity);
		
		if (transform.position.z != 0) {
			transform.position = previousStates[0].position;
		}
		
		//Change velocity depending on collision
		if (vehicleHit.distance > 0) {
			currentStates[0].velocity -= 0.9*Vector3.Scale(vehicleHit.normal, currentStates[0].velocity);
			Debug.DrawRay(vehicleHit.point, vehicleHit.normal, Color.red, 0.1);
		}
		
		currentStates[0].position = transform.position;
		
		currentStates[0].rotation += input.rotation*TurnSpeed*deltaTime;
		currentStates[0].rotation = Mathf.Clamp01(currentStates[0].rotation);
	}
	else if (slot == 1) {
		
	}
	
	MoveApplyStates(slot, deltaTime);
	return nextStates[slot];
}

function ClampVelocity(slot:int) {
	currentStates[slot].velocity.x = Mathf.Clamp(currentStates[slot].velocity.x, -MaxVelocity.x, MaxVelocity.x);
	currentStates[slot].velocity.y = Mathf.Clamp(currentStates[slot].velocity.y, -MaxVelocity.y, MaxVelocity.y);
}

function MoveCopyStates(slot:int) {
	//Copy states
	ApplyState(slot, nextStates[slot]);
	previousStates[slot] = nextStates[slot].Copy();
	currentStates[slot] = nextStates[slot].Copy();
}

function MoveApplyStates(slot:int, deltaTime:float) {
	//Apply States
	nextStates[slot] = currentStates[slot].Copy();
	nextStates[slot].timestamp = Time.time + deltaTime;
	ApplyState(slot, previousStates[slot]);
}

function WeaponInputFire(slot:int, time:float):boolean {
	if (currentStates[0].rotation == 0 || currentStates[0].rotation == 1){
		if (slot == 0) {
			if (MinigunFireTimer < time) {
				MinigunFireTimer = time + MinigunGun.FireSpeed;
				return true;
			}
		}
		else if (slot == 1) {
			if (CanonFireTimer < time) {
				CanonFireTimer = time + CanonGun.FireSpeed;
				return true;
			}
		}
	}
	return false;
}

function WeaponInputFireDown(slot:int, time:float):boolean {
	return false;
}

function WeaponFire(slot:int) {
	if (slot == 0) {
		tmpFloat = GetRandom();
		currentStates[0].lookAngle = Mathf.Clamp(90 - currentStates[0].lookAngle, -MaxRotation, MaxRotation) - 90;
		tmpQuat = Quaternion.Euler(0, 0, tmpFloat*MinigunGun.BulletSpreadHip + currentStates[0].lookAngle*Mathf.Lerp(-1, 1, currentStates[0].rotation));
		
		prjt = Instantiate(networkManager.Bullets[MinigunGun.BulletType], transform.position, tmpQuat).GetComponent(typeof(Projectile)) as Projectile;
		prjt.gun = MinigunGun;
		prjt.NetId = vehicle.Slots[slot];
		prjt.networkManager = networkManager;
		prjt.Shoot();
	}
	else if (slot == 1) {
		tmpFloat = GetRandom();
		tmpQuat = Quaternion.Euler(0, 0, tmpFloat*CanonGun.BulletSpreadHip + currentStates[1].lookAngle*Mathf.Lerp(-1, 1, currentStates[1].rotation));
		
		prjt = Instantiate(networkManager.Bullets[CanonGun.BulletType], Canon.transform.position, tmpQuat).GetComponent(typeof(Projectile)) as Projectile;
		prjt.gun = CanonGun;
		prjt.NetId = vehicle.Slots[slot];
		prjt.networkManager = networkManager;
		prjt.Shoot();
	}
}

function ApplyState(slot:int, state:VehicleState) {
	if (slot == 0) {
		transform.position = state.position;
		Cams[0].transform.position = state.position - Vector3.forward*DriverViewDistance;
		Cams[0].transform.rotation = Quaternion.identity;
		Cams[0].transform.parent = null;
		
		transform.eulerAngles.y = Mathf.Lerp(180, 0, state.rotation);
		
		Cams[0].transform.parent = transform;
		//transform.eulerAngles.z = Mathf.Clamp(90 - state.lookAngle, -MaxRotation, MaxRotation);
	}
	else if (slot == 1) {
		Canon.eulerAngles.z = Mathf.Clamp(90 - state.lookAngle, -MaxRotation, MaxRotation);
	}
}

function OnVehicleControllerHit(hit:RaycastHit) {
	vehicleHit = hit;
}

}