#pragma strict

/*
===========================
Classes
===========================
*/

class VehicleBounds {
	var size:Vector3;
	var offset:Vector3;
	
	function VehicleBounds(s:Vector3) {
		this.size = s;
		this.offset = Vector3.zero;
	}
	
	function VehicleBounds(s:Vector3, o:Vector3) {
		this.size = s;
		this.offset = o;
	}
	
	function DrawGizmo(transform:Transform) {
		DrawGizmo(transform, Color.white);
	}
	
	function DrawGizmo(transform:Transform, color:Color) {
		var points:Vector3[] = GetPoints(transform);
		
		Gizmos.color = color;
		
		//TopFace
		Gizmos.DrawLine(points[0], points[1]);
		Gizmos.DrawLine(points[1], points[2]);
		Gizmos.DrawLine(points[2], points[3]);
		Gizmos.DrawLine(points[3], points[0]);
		
		//BottomFace
		Gizmos.DrawLine(points[4], points[5]);
		Gizmos.DrawLine(points[5], points[6]);
		Gizmos.DrawLine(points[6], points[7]);
		Gizmos.DrawLine(points[7], points[4]);
		
		//Connections
		Gizmos.DrawLine(points[0], points[4]);
		Gizmos.DrawLine(points[1], points[5]);
		Gizmos.DrawLine(points[2], points[6]);
		Gizmos.DrawLine(points[3], points[7]);
	}
	
	function Contains(transform:Transform, point:Vector3):boolean {
		var points:Vector3[] = GetPoints(transform);
		
		//check if dot product of the point to the center of all sides is positive
		//Then point is inside of box
		
		//top
		if (Vector3.Dot(Vector3.Cross(points[1] - points[0], points[2] - points[0]), (points[0] + points[2])/2 - point) < 0) {
			return false;
		}
		
		//bottom
		if (Vector3.Dot(Vector3.Cross(points[5] - points[4], points[6] - points[4]), (points[4] + points[6])/2 - point) > 0) {
			return false;
		}
		
		//front
		if (Vector3.Dot(Vector3.Cross(points[1] - points[0], points[4] - points[0]), (points[0] + points[5])/2 - point) > 0) {
			return false;
		}
		
		//back
		if (Vector3.Dot(Vector3.Cross(points[2] - points[3], points[7] - points[3]), (points[3] + points[6])/2 - point) < 0) {
			return false;
		}
		
		//back
		if (Vector3.Dot(Vector3.Cross(points[2] - points[1], points[5] - points[1]), (points[2] + points[5])/2 - point) > 0) {
			return false;
		}
		
		//left
		if (Vector3.Dot(Vector3.Cross(points[3] - points[0], points[4] - points[0]), (points[3] + points[4])/2 - point) < 0) {
			return false;
		}
		
		return true;
	}
	
	private function GetPoints(transform:Transform):Vector3[] {
		var points:Vector3[] = new Vector3[8];
		
		//Top
		points[0] = transform.TransformPoint(offset + Vector3(size.x, size.y, size.z)/2.0);
		points[1] = transform.TransformPoint(offset + Vector3(size.x, size.y, -size.z)/2.0);
		points[2] = transform.TransformPoint(offset + Vector3(-size.x, size.y, -size.z)/2.0);
		points[3] = transform.TransformPoint(offset + Vector3(-size.x, size.y, size.z)/2.0);
		
		//Bottom
		points[4] = transform.TransformPoint(offset + Vector3(size.x, -size.y, size.z)/2.0);
		points[5] = transform.TransformPoint(offset + Vector3(size.x, -size.y, -size.z)/2.0);
		points[6] = transform.TransformPoint(offset + Vector3(-size.x, -size.y, -size.z)/2.0);
		points[7] = transform.TransformPoint(offset + Vector3(-size.x, -size.y, size.z)/2.0);
		
		return points;
	}
}

class VehicleState {
	var timestamp:float;
	
	var position:Vector3 = Vector3.zero;
	var rotation:float = 0;
	
	var velocity:Vector3;
	
	var lookAngle:float = 90;
	
	function VehicleState() {
		timestamp = Time.time;
	}
	
	function Copy() {
		var state:VehicleState = new VehicleState();
		
		state.position = position;
		state.rotation = rotation;
		
		state.velocity = velocity;
		
		state.lookAngle = lookAngle;
		
		return state;
	}
	
	static function Lerp(state1:VehicleState, state2:VehicleState, t:float) {
		var state:VehicleState = new VehicleState();
		
		state.position = Vector3.Lerp(state1.position, state2.position, t);
		state.rotation = Mathf.Lerp(state1.rotation, state2.rotation, t);
		
		state.velocity = Vector3.Lerp(state1.velocity, state2.velocity, t);
		
		state.lookAngle = Mathf.Lerp(state1.lookAngle, state2.lookAngle, t);
		
		return state;
	}
}

class Vehicle extends MonoBehaviour {

/*
===========================
Variables
===========================
*/

//Vehicle States
@System.NonSerialized
var nextStates:VehicleState[];
@System.NonSerialized
var currentStates:VehicleState[];
@System.NonSerialized
var previousStates:VehicleState[];
private var state:VehicleState;
private var weight:float;
@System.NonSerialized
var Dead:boolean;

//Vehicle Attributes
var SlotNumber:int = 2;

var EnterBoundsSize:Vector3;
private var bounds:VehicleBounds;

@System.NonSerialized
var Slots:int[];
@System.NonSerialized
var Cams:GameObject[];
private var i:int;

var hasDamage:boolean;
var BulletResistance:float = 1;
var Health:float;
@System.NonSerialized
var damageInstances:List.<DamageInstance>;

@System.NonSerialized
var DNO:DynamicNetworkObject;
@System.NonSerialized
var networkManager:NetworkManager;
@System.NonSerialized
var index:int;
@System.NonSerialized
var type:int;

var _team:int;
function get team():int {
	return _team;
}

//Vehicle Extensions
private var vehicleInstance:VehicleInstance;

//Temporary
private var IndexList:int;
private var IndexList2:int;

private var tmpFloat:float;

/*===
Random Generator
===*/

@System.NonSerialized
var seed:int;
@System.NonSerialized
var sign:int = 1;
private var randNum:float;

function GetRandom() {
	Random.seed = seed;
	randNum = Random.value;
	seed = Random.Range(1, 10000);
	sign *= -1;
	return randNum*sign;
}

/*
===========================
Inbuilt Functions
===========================
*/

function Start() {
	Slots = new int[SlotNumber];
	Cams = new GameObject[SlotNumber];
	for (i = 0; i < Slots.length; i += 1) {
		Slots[i] = -1;
		Cams[i] = new GameObject("Camera" + i);
		Cams[i].transform.parent = transform;
		Cams[i].transform.localPosition = Vector3.zero;
	}
	
	//Setup States
	nextStates = new VehicleState[SlotNumber];
	for (i = 0; i < nextStates.length; i += 1) {
		nextStates[i] = new VehicleState();
		nextStates[i].position = transform.position;
	}
	
	currentStates = new VehicleState[SlotNumber];
	for (i = 0; i < currentStates.length; i += 1) {
		currentStates[i] = new VehicleState();
		currentStates[i].position = transform.position;
	}
	
	previousStates = new VehicleState[SlotNumber];
	for (i = 0; i < previousStates.length; i += 1) {
		previousStates[i] = new VehicleState();
		previousStates[i].position = transform.position;
	}
	
	DNO = GetComponent(typeof(DynamicNetworkObject)) as DynamicNetworkObject;

	//Gather Extentions
	vehicleInstance = GetComponent(typeof(VehicleInstance)) as VehicleInstance;
	
	//Setup Lists
	damageInstances = new List.<DamageInstance>();
	
}

function Update() {
	//Update Team
	_team = 0;
	for (i = 0; i < Slots.length; i += 1) {
		if (Slots[i] >= 0) {
			_team = networkManager.NPlayers[Slots[i]].team;
		}
	}
	
	//Update layers
	if (team == 0) {
		gameObject.layer = 13;
	}
	else {
		gameObject.layer = 7 + team;
	}
	vehicleInstance.gameObject.layer = gameObject.layer;
	
	//Update Vehicle
	for (i = 0; i < SlotNumber; i += 1) {
		
		if (Slots[i] >= 0) {
			if (networkManager.NPlayers[Slots[i]].object.Active) {
				nextStates[i].lookAngle = currentStates[i].lookAngle;
				previousStates[i].lookAngle = currentStates[i].lookAngle;
			}
		}
		
		weight = (Time.time - previousStates[i].timestamp)/(nextStates[i].timestamp - previousStates[i].timestamp);
		currentStates[i] = VehicleState.Lerp(previousStates[i], nextStates[i], weight);
		ApplyState(i, currentStates[i]);
	}
}

/*
===========================
Helper Functions
===========================
*/

function CheckInBounds(point:Vector3):boolean {
	bounds = VehicleBounds(EnterBoundsSize);
	return bounds.Contains(transform, point);
}

function PlayerEnter(id:int) {
	if (team == 0 || team == networkManager.NPlayers[id].team) {
		for (i = 0; i < Slots.length; i += 1) {
			if (Slots[i] < 0) {
				Slots[i] = id;
				networkManager.NPlayers[id].vehicleSlot = i;
				return true;
			}
		}
	}
	
	return false;
}

function PlayerLeave(id:int) {
	for (i = 0; i < Slots.length; i += 1) {
		if (Slots[i] == id) {
			Slots[i] = -1;
		}
	}
}

function OnDrawGizmosSelected() {
	bounds = VehicleBounds(EnterBoundsSize);
	bounds.DrawGizmo(transform);
}

//Vehicle Input Functions
function Move(slot:int, input:InputState, deltaTime:float):VehicleState {
	return vehicleInstance.Move(slot, input, deltaTime);
}

function ApplyState(slot:int, state:VehicleState) {
	vehicleInstance.ApplyState(slot, state);
}

function WeaponInput(slot:int, time:float) {
	return WeaponInputFire(slot, time) || WeaponInputFireDown(slot, time);
}

function WeaponInputFire(slot:int, time:float):boolean {
	if (vehicleInstance.WeaponInputFire(slot, time)) {
		WeaponFire(slot);
		return true;
	}
	return false;
}

function WeaponInputFireDown(slot:int, time:float):boolean {
	if (vehicleInstance.WeaponInputFireDown(slot, time)) {
		WeaponFire(slot);
		return true;
	}
	return false;
}

function WeaponFire(slot:int) {
	vehicleInstance.WeaponFire(slot);
}

/*===
Health System
===*/

function Kill() {
	Dead = true;
	Destroy(gameObject);
}

function Damage(amount:float) {
	Damage(-1, amount, 1, "");
}

function Damage(amount:float, weapon:String) {
	Damage(-1, amount, 1, weapon);
}

function Damage(id:int, amount:float) {
	Damage(id, amount, 1, "");
}

function Damage(id:int, amount:float, weapon:String) {
	Damage(id, amount, 1, weapon);
}

function Damage(id:int, amount:float, multiplier:float) {
	Damage(id, amount, multiplier, "");
}

function Damage(id:int, amount:float, multiplier:float, weapon:String) {
	tmpFloat = Mathf.Min(amount*multiplier, Health);
	Health -= tmpFloat;
	
	if (!(id in Slots) && id >= 0) {
		damageInstances.Add(DamageInstance(id, tmpFloat));
	}
	
	if (Network.isServer && !Dead) {
		networkManager.server.OnVehicleDamaged(index, id, tmpFloat, weapon);
		if (Health <= 0) {
			networkManager.server.OnVehicleKilled(index, id, multiplier, weapon);
		}
	}
}

function CompileDamages() {
	for (IndexList = 0; IndexList < damageInstances.Count; IndexList += 1) {
		IndexList2 = IndexList + 1;
		while (IndexList2 < damageInstances.Count) {
			if (damageInstances[IndexList2].id == damageInstances[IndexList].id) {
				damageInstances[IndexList].amount += damageInstances[IndexList2].amount;
				damageInstances.RemoveAt(IndexList2);
			}
			else {
				IndexList2 += 1;
			}
		}
	}
}






}

//Inheritable class for all vehicle instances
class VehicleInstance extends MonoBehaviour {
	@System.NonSerialized
	var vehicle:Vehicle;
	
	function get nextStates():VehicleState[] {
		return vehicle.nextStates;
	}
	
	function get currentStates():VehicleState[] {
		return vehicle.currentStates;
	}
	
	function get previousStates():VehicleState[] {
		return vehicle.previousStates;
	}
	
	function get Cams():GameObject[] {
		return vehicle.Cams;
	}
	
	function get networkManager():NetworkManager {
		return vehicle.networkManager;
	}
	
	function Awake() {
		vehicle = GetComponent(typeof(Vehicle)) as Vehicle;
	}
	
	function GetRandom() {
		return vehicle.GetRandom();
	}
	
	function Move(slot:int, input:InputState, deltaTime:float) {
		return nextStates[slot];
	}
	
	function ApplyState(slot:int, state:VehicleState) {
	}
	
	function WeaponInputFire(slot:int, time:float) {
		return false;
	}
	
	function WeaponInputFireDown(slot:int, time:float) {
		return false;
	}
	
	function WeaponFire(slot:int) {
	}
	
	function OnVehicleControllerHit(hit:RaycastHit) {
	}
}