#pragma strict
import System.Collections.Generic;
import System.Linq;

/*
===========================
Classes
===========================
*/

class InputState {
	var horizontal:float = 0;
	var vertical:float = 0;
	
	var rotation:float = 0;
	var crouch:float = 0;
	
	var switchTo:int;
	
	var sprint:boolean = false;
	var jump:boolean = false;
	var ladder:boolean = false;
	
	var times:int;
	
	function Average() {
		if (times != 0) {
			horizontal /= times;
			vertical /= times;
			
			rotation /= times;
			crouch /= times;
		}
	}
	
	function Reset() {
		horizontal = 0;
		vertical = 0;
		
		rotation = 0;
		crouch = 0;
		
		sprint = false;
		jump = false;
		ladder = false;
		
		times = 0;
	}
	
	function Copy() {
		var inpS:InputState = new InputState();
		
		inpS.horizontal = horizontal;
		inpS.vertical = vertical;
		
		inpS.rotation = rotation;
		inpS.crouch = crouch;
		
		inpS.switchTo = switchTo;
		
		inpS.sprint = sprint;
		inpS.jump = jump;
		inpS.ladder = ladder;
		
		return inpS;
	}
}

class PlayerState {
	var timestamp:float;
	var input:InputState;
	
	//Movement
	var position:Vector3 = Vector3.zero;
	var velocity:Vector3 = Vector3.zero;
	var acceleration:Vector3 = Vector3.zero;
	
	var rotation:float = 0;
	var aimWeight:float = 0;
	
	var grounded:boolean = true;
	var ladder:boolean = false;
	
	//Other
	var lookAngle:float = 90;
	
	//Gun
	var selectionWeight:float = -1;
	var selected:int = 0;
	
	//Animation
	var crouchWeight:float = 0;
	var standWeight:float = 0;
	
	var animationState:int = 0;
	
	function PlayerState() {
		timestamp = Time.time;
	}
	
	function PlayerState(pl:Player) {
		timestamp = Time.time;
		
		position = pl.transform.position;
		
		if (pl.currentState) {
			velocity = pl.currentState.velocity;
			acceleration = pl.currentState.acceleration;
			
			rotation = pl.currentState.rotation;
			
			grounded = pl.currentState.grounded || pl.controller.isGrounded;
			ladder = pl.currentState.ladder;
			
			selectionWeight = pl.currentState.selectionWeight;
			selected = pl.currentState.selected;
			
			crouchWeight = pl.currentState.crouchWeight;
			standWeight = pl.currentState.standWeight;
			
			animationState = pl.currentState.animationState;
		}
	}
	
	function Copy() {
		var state:PlayerState = new PlayerState();
		state.position = position;
		
		state.velocity = velocity;
		state.acceleration = acceleration;
		
		state.rotation = rotation;
		
		state.aimWeight = aimWeight;
		state.lookAngle = lookAngle;
		
		state.grounded = grounded;
		state.ladder = ladder;
		
		//Gun
		state.selectionWeight = selectionWeight;
		state.selected = selected;
		
		state.crouchWeight = crouchWeight;
		state.standWeight = standWeight;
		
		state.animationState = animationState;
		
		return state;
	}
	
	//Lerp everything
	static function Lerp(state1:PlayerState, state2:PlayerState, t:float) {
		var state:PlayerState = new PlayerState();
		t = Mathf.Clamp01(t);
		
		//Lerpable Values
		state.timestamp = Mathf.Lerp(state1.timestamp, state2.timestamp, t);
		
		state.position = Vector3.Lerp(state1.position, state2.position, t);
		state.velocity = Vector3.Lerp(state1.velocity, state2.velocity, t);
		state.acceleration = Vector3.Lerp(state1.acceleration, state2.acceleration, t);
		
		state.rotation = Mathf.LerpAngle(state1.rotation, state2.rotation, t);
		
		state.aimWeight = Mathf.LerpAngle(state1.aimWeight, state2.aimWeight, t);
		state.lookAngle = Mathf.LerpAngle(state1.lookAngle, state2.lookAngle, t);
		
		state.selectionWeight = Mathf.Lerp(state1.selectionWeight, state2.selectionWeight, t);
		if (t > 0.5) {
			state.selected = state2.selected;
		}
		else {
			state.selected = state1.selected;
		}
		
		state.crouchWeight = Mathf.Lerp(state1.crouchWeight, state2.crouchWeight, t);
		state.standWeight = Mathf.Lerp(state1.standWeight, state2.standWeight, t);
		
		//Unlerpable Values
		state.grounded = state2.grounded;
		state.ladder = state2.ladder;
		
		state.animationState = state2.animationState;
		
		return state;
	}
}

class DamageInstance {
	var amount:float;
	var id:int;
	
	function DamageInstance(i:int, a:float) {
		id = i;
		amount = a;
	}
}

class Player extends MonoBehaviour {

/*
===========================
Variables
===========================
*/

//System Variables
@System.NonSerialized
var Active:boolean;
@System.NonSerialized
var Dead:boolean = false;
@System.NonSerialized
var networkManager:NetworkManager;
@System.NonSerialized
var NetId:int;

//Health/Regen
var MaxHealth:float = 100;

var Health:float;
var HealthRegen:float;
var RegenSpeed:float;
@System.NonSerialized
private var regenTimer:float;
private var ammoRegenLeft:float;

//Reference Variables
var Soldier:Transform;

var cam:Camera;
var Aimcam:Camera;
var Norcam:Camera;

var LagCompensator:Transform;
var UpperBody:Transform;
var Head:Transform;
@System.NonSerialized
var controller:CharacterController;

var NPASkin:Transform;
var PCDSkin:Transform;

//Iteratory/Optimisations
private var tempBullet:Projectile;
private var audioPrefab:AudioSource;
private var ladder:Ladder;

private var gun:Gun;

private var rigidTemp:Rigidbody;
private var renderers:Renderer;
private var colliders:Collider;

private var IndexList:int;
private var IndexList2:int;

private var tmpQuat:Quaternion;
private var tmpFloat:float;
private var rstwd:float;
private var counter:int;

private var weight:float;

private var np:NPlayer;
private var prjt:Projectile;

/*===
Movement/Animation
===*/

//Movement Variables
var WalkSpeed:float;
var RunSpeed:float;
var JumpSpeed:float;
var CrouchSpeed:float;
var TurnSpeed:float;
var AirAcc:float;
var Gravity:float;
var GroundingForce:float;
var LadderClimbSpeed:float;
var WeaponSwapSpeed:float;
var GreadeThrowStrength:float;

//Save States
@System.NonSerialized
var previousState:PlayerState;
@System.NonSerialized
var nextState:PlayerState;
@System.NonSerialized
var currentState:PlayerState;

@System.NonSerialized
var damageInstances:List.<DamageInstance>;

/*===
Weapon System
===*/

//References
var GunsMain:Gun[];
var GunsSecondary:Gun[];

//States
@System.NonSerialized
var equipped:Gun[];
function get currentWeapon():Gun {
	return equipped[currentState.selected];
}

@System.NonSerialized
var GrenadeType:int;
var GrenadeAmmo:int = 2;

//Timers/Counters
private var weaponTimer:float = 0;
@System.NonSerialized
var weaponReloading:boolean = false;
@System.NonSerialized
var weaponSwitching:boolean = false;
private var fireAccuracy:float;
private var lastFireAccuracy:float;

private var weaponBurstCount:int = 0;
var weaponReloadStage:int = 0;

//Input Variables
private var FireDown:boolean;
private var CanFire:boolean;
private var switchto:int = 0;

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

/*===
Server Only
===*/

private var state1:PlayerState;
private var state2:PlayerState;
private var LagStates:List.<PlayerState>;

/*
===========================
Inbuilt Functions
===========================
*/

function Awake() {
	//Gun Initial Setup
	for (IndexList = 0; IndexList < GunsMain.length; IndexList += 1) {
		GunsMain[IndexList].index = IndexList;
	}
	
	for (IndexList = 0; IndexList < GunsSecondary.length; IndexList += 1) {
		GunsSecondary[IndexList].index = IndexList;
	}
	
	//Disable Ragdoll
	for (rigidTemp in (Soldier.GetComponentsInChildren(typeof(Rigidbody)) as IEnumerable).Cast.<Rigidbody>()) {
		rigidTemp.isKinematic = true;
		rigidTemp.collider.enabled = false;
	}
	
	//Get references
	controller = gameObject.GetComponent(typeof(CharacterController)) as CharacterController;
	
	//Set defaults for animation
	Soldier.animation["StandingAimUp"].AddMixingTransform(UpperBody);
	Soldier.animation["StandingAimDown"].AddMixingTransform(UpperBody);
	Soldier.animation["CrouchAimUp"].AddMixingTransform(UpperBody);
	Soldier.animation["CrouchAimDown"].AddMixingTransform(UpperBody);
	Soldier.animation["StandingAimUp"].speed = 0;
	Soldier.animation["StandingAimDown"].speed = 0;
	Soldier.animation["CrouchAimUp"].speed = 0;
	Soldier.animation["CrouchAimDown"].speed = 0;
	Soldier.animation["StandingFire"].layer = 3;
	Soldier.animation["StandingReloadM4"].layer = 3;
	Soldier.animation["StandingAimUp"].layer = 2;
	Soldier.animation["StandingAimDown"].layer = 2;
	Soldier.animation["CrouchAimUp"].layer = 2;
	Soldier.animation["CrouchAimDown"].layer = 2;
	Soldier.animation["CrouchAimUp"].blendMode = AnimationBlendMode.Additive;
	Soldier.animation["CrouchAimDown"].blendMode = AnimationBlendMode.Additive;
	Soldier.animation["StandingFire"].blendMode = AnimationBlendMode.Additive;
	Soldier.animation["StandingReloadM4"].blendMode = AnimationBlendMode.Additive;
	
	//Set States
	Health = MaxHealth;
	
	Aimcam.enabled = false;
	Norcam.enabled = false;
	cam.enabled = false;
	
	transform.position.z = 0;
	transform.rotation = Quaternion.identity;
	
	currentState = new PlayerState(this);
	previousState = currentState.Copy();
	previousState.timestamp = Time.time;
	nextState = currentState.Copy();
	
	damageInstances = new List.<DamageInstance>();
	
	if (Network.isServer) {
		LagStates = new List.<PlayerState>();
	}
}

function Start() {
	for (colliders in LagCompensator.GetComponentsInChildren(Collider)) {
		colliders.gameObject.layer = 9 + networkManager.NPlayers[NetId].team;
	}
	
	nextState.timestamp = Time.time + 1.0/networkManager.UPS;
}

function Update() {
	gameObject.layer = 7 + networkManager.NPlayers[NetId].team;
	
	if (!networkManager.NPlayers[NetId].vehicle && Active) {
		controller.enabled = true;
		LagCompensator.gameObject.SetActive(true);
		
		tmpFloat = Mathf.Lerp(-1, 1, currentState.rotation);
		
		Norcam.transform.position.y = Head.position.y;
		Norcam.transform.eulerAngles.z = networkManager.client.recoil.y*(1-Mathf.Abs(networkManager.client.recoilWeight-1))/4;
		
		Aimcam.transform.rotation = Quaternion.identity;
		rstwd = Screen.width/2 - Aimcam.WorldToScreenPoint(Vector3(Aimcam.transform.position.x - 1, 0, 0)).x;
		Aimcam.transform.localPosition.x = tmpFloat*((Screen.width/2 - 20)/rstwd - networkManager.client.recoil.y*(1-Mathf.Abs(networkManager.client.recoilWeight-1))/40);
		Aimcam.transform.localRotation = Quaternion.identity;
		
		Aimcam.transform.parent.position.y = Head.position.y;
		Aimcam.transform.parent.eulerAngles.z = (90-currentState.lookAngle)*tmpFloat;
		Aimcam.transform.localPosition.z = -currentWeapon.Sight[currentWeapon.Addons[0]].VewDistance;
		
		cam.transform.position = Vector3.Lerp(Norcam.transform.position, Aimcam.transform.position, currentState.aimWeight);
		cam.transform.eulerAngles.z = Mathf.LerpAngle(Norcam.transform.eulerAngles.z, Aimcam.transform.eulerAngles.z, currentState.aimWeight);
		
		previousState.lookAngle = currentState.lookAngle;
		nextState.lookAngle = currentState.lookAngle;
		previousState.aimWeight = currentState.aimWeight;
		nextState.aimWeight = currentState.aimWeight;
	}
	
	weight = (Time.time - previousState.timestamp)/(nextState.timestamp - previousState.timestamp);
	currentState = PlayerState.Lerp(previousState, nextState, weight);
	
	if (networkManager.NPlayers[NetId].vehicle) {
		currentState.position = networkManager.NPlayers[NetId].vehicle.transform.position;
		nextState.position = networkManager.NPlayers[NetId].vehicle.transform.position;
		previousState.position = networkManager.NPlayers[NetId].vehicle.transform.position;
		controller.enabled = false;
		LagCompensator.gameObject.SetActive(false);
	}
	
	ApplyState(currentState);
	
	if (Network.isServer) {
		if (regenTimer < Time.time) {
			//Regen Health
			tmpFloat = networkManager.GetHealthRegen(transform.position);
			Heal(HealthRegen + tmpFloat);
			
			//Regen Ammo
			if (!weaponSwitching) {
				tmpFloat = networkManager.GetAmmoRegen(transform.position)/100.0 * currentWeapon.AmmoMax;
				tmpFloat += ammoRegenLeft;
				ammoRegenLeft = tmpFloat - Mathf.Floor(tmpFloat);
				
				currentWeapon.Ammo += Mathf.Min(Mathf.Floor(tmpFloat), currentWeapon.AmmoMax - currentWeapon.Ammo);
			}
			
			//Reset Timer
			regenTimer = Time.time + RegenSpeed;
		}
	}
	else {
		ApplyLagState(currentState);
	}
}

/*
===========================
Helper Functions
===========================
*/

/*===
Health
===*/

function Kill() {
	for (rigidTemp in (Soldier.GetComponentsInChildren(Rigidbody) as IEnumerable).Cast.<Rigidbody>()) {
		rigidTemp.isKinematic = false;
		rigidTemp.collider.enabled = true;
		rigidTemp.velocity = currentState.velocity;
	}
	
	(Soldier.GetComponent(typeof(KillAfterTime)) as KillAfterTime).enabled = true;
	Destroy(Soldier.animation);
	Destroy(Soldier.GetComponent("LegAnimator"));
	Soldier.parent = null;
	Destroy(gameObject);
}

function Resupply(amount:int) {
    Resupply(NetId, amount);
}

function Resupply(id:int, amount:int) {
    for (gun in equipped) {
        gun.Ammo += amount/100f * gun.AmmoMax;
        gun.Ammo = Mathf.Min(gun.AmmoMax, gun.Ammo);
    }
    
    if (Network.isServer) {
        networkManager.server.OnPlayerResupplied(NetId, id, amount);
    }
}

function Heal(amount:float) {
	Heal(NetId, amount);
}

function Heal(id:int, amount:float) {
	tmpFloat = Mathf.Min(amount, MaxHealth - Health);
	Health += tmpFloat;
	
	if (Network.isServer) {
		networkManager.server.OnPlayerHealed(NetId, id, amount);
	}
}

function Damage(amount:float) {
	Damage(NetId, amount, 1, "");
}

function Damage(amount:float, weapon:String) {
	Damage(NetId, amount, 1, weapon);
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
	
	if (id != NetId && id >= 0) {
		damageInstances.Add(DamageInstance(id, tmpFloat));
	}
	
    if (!Dead) {
        if (Network.isServer) {
            networkManager.server.OnPlayerDamaged(NetId, id, tmpFloat, weapon);
            if (Health <= 0) {
                networkManager.server.OnPlayerKilled(NetId, id, multiplier, weapon);
            }
        }
        if (networkManager.client.enabled && networkManager.client.NetId == NetId) {
            networkManager.client.OnPlayerDamaged(tmpFloat);
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

/*===
Movement/Animations
===*/

function ApplyState(state:PlayerState) {
	if (transform) {
		transform.position = state.position;
		Soldier.transform.eulerAngles.y = Mathf.Lerp(270, 90, state.rotation);
	    
	    if (currentState.selected != previousState.selected) {
			HideGun(equipped[previousState.selected]);
			ShowGun(equipped[currentState.selected]);
		}
	    
		ApplyAnimations(state, Time.deltaTime);
	}
}

function SetupanimationStates() {
	Soldier.animation["StandingAimUp"].enabled = false;
	Soldier.animation["StandingAimDown"].enabled = false;
	Soldier.animation["CrouchAimUp"].enabled = false;
	Soldier.animation["CrouchAimDown"].enabled = false;
	if (Soldier.animation["Locomotion1"]) {
		Soldier.animation["Locomotion1"].enabled = true;
		Soldier.animation["Locomotion2"].enabled = true;
	}
	Soldier.animation["StandingFire"].weight = 1;
}

function ApplyAnimations(state:PlayerState, deltaTime:float) {
	SetupanimationStates();
	
	//Calculate Aim Animation Weights from animation State
	if (state.animationState == 0 || (state.animationState == 3)) {
		Soldier.animation["StandingAimUp"].weight += CrouchSpeed * deltaTime;
		Soldier.animation["StandingAimDown"].weight += CrouchSpeed * deltaTime;
		Soldier.animation["CrouchAimUp"].weight -= CrouchSpeed * deltaTime;
		Soldier.animation["CrouchAimDown"].weight -= CrouchSpeed * deltaTime;
	}
	else if (state.animationState == 2) {
		Soldier.animation["StandingAimUp"].weight -= CrouchSpeed * deltaTime;
		Soldier.animation["StandingAimDown"].weight -= CrouchSpeed * deltaTime;
		Soldier.animation["CrouchAimUp"].weight += CrouchSpeed * deltaTime;
		Soldier.animation["CrouchAimDown"].weight += CrouchSpeed * deltaTime;
	}
	else {
		Soldier.animation["StandingAimUp"].weight -= CrouchSpeed * deltaTime;
		Soldier.animation["StandingAimDown"].weight -= CrouchSpeed * deltaTime;
		Soldier.animation["CrouchAimUp"].weight -= CrouchSpeed * deltaTime;
		Soldier.animation["CrouchAimDown"].weight -= CrouchSpeed * deltaTime;
	}
	
	Soldier.animation["StandingAimUp"].weight = Mathf.Clamp01(Soldier.animation["StandingAimUp"].weight);
	Soldier.animation["StandingAimDown"].weight = Mathf.Clamp01(Soldier.animation["StandingAimDown"].weight);
	Soldier.animation["CrouchAimUp"].weight = Mathf.Clamp01(Soldier.animation["CrouchAimUp"].weight);
	Soldier.animation["CrouchAimDown"].weight = Mathf.Clamp01(Soldier.animation["CrouchAimDown"].weight);
	
	//Apply Aim Animation time from look Angle
	if (state.lookAngle < 90) {
		Soldier.animation["StandingAimUp"].enabled = true;
		Soldier.animation["CrouchAimUp"].enabled = true;
		Soldier.animation["StandingAimUp"].normalizedTime = 1 - (state.lookAngle / 90);
		Soldier.animation["CrouchAimUp"].normalizedTime = 1 - (state.lookAngle / 90);
	}
	else {
		Soldier.animation["CrouchAimDown"].enabled = true;
		Soldier.animation["StandingAimDown"].enabled = true;
		Soldier.animation["CrouchAimDown"].normalizedTime = (state.lookAngle - 90) / 90;
		Soldier.animation["StandingAimDown"].normalizedTime = (state.lookAngle - 90) / 90;
	}
	
	//Apply Movement Animations According to state weights
	Soldier.animation["RunJump"].weight = 1 - (state.standWeight + state.crouchWeight);
	if (Soldier.animation["Locomotion1"]) {
		Soldier.animation["Locomotion1"].weight = state.standWeight;
		Soldier.animation["Locomotion2"].weight = state.crouchWeight;
	}
	
	//Change controller in accordance with animations
	controller.height = 2 - state.crouchWeight;
	controller.center.y = -0.5*state.crouchWeight;
}

function Move(input:InputState, deltaTime:float) {
    networkManager.NPlayers[NetId].lastUpdateTime = Time.time;
    
	//Update previous
	ApplyState(nextState);
	previousState = nextState.Copy();
	currentState = previousState.Copy();
	
	//Check for laddering
	ladder = networkManager.CheckLadder(NetId);
	if (input.ladder && ladder) {
		currentState.ladder = true;
		currentState.acceleration = Vector3.zero;
		currentState.velocity = Vector3.zero;
		currentState.velocity.y = input.vertical*LadderClimbSpeed*deltaTime;
		
		currentState.position.x = ladder.Top.position.x;
		controller.Move(currentState.velocity*deltaTime);
		currentState.position.y = Mathf.Clamp(transform.position.y, ladder.Bottom.position.y + 0.4, ladder.Top.position.y - 0.4);
		currentState.position.z = 0;
		
		currentState.grounded = false;
		currentState.crouchWeight -= deltaTime*CrouchSpeed;
		currentState.standWeight += deltaTime*CrouchSpeed;
		currentState.crouchWeight = Mathf.Clamp01(currentState.crouchWeight);
		currentState.standWeight = Mathf.Clamp01(currentState.standWeight);
		currentState.animationState = 0;
	}
	else {
		currentState.ladder = false;
		currentState.acceleration = Vector3(0, -Gravity * 0.02, 0);
		
		//Convert Input to character acceleration
		if ((input.jump && previousState.grounded) || (input.vertical > 0.2 && previousState.ladder)) {
			currentState.velocity.y = JumpSpeed;
		}
		
		if ((controller.collisionFlags & CollisionFlags.Above) && currentState.velocity.y > 0) {
			currentState.velocity.y = 0;
		}
		
		if (previousState.grounded && currentState.velocity.y < 0) {
			currentState.velocity.y = -GroundingForce;
		}
		
		if (previousState.grounded) {
			currentState.acceleration.x = input.horizontal * WalkSpeed * 3;
			if (currentState.acceleration.x == 0) {
				currentState.velocity.x = 0;
			}
		}	
		else {
			currentState.acceleration.x = input.horizontal * AirAcc;
		}
		
		//add helf acceleration
		currentState.velocity += currentState.acceleration/2*deltaTime*50;
		ClampVelocity(currentState, input);
		
		//move player
		controller.Move(currentState.velocity * deltaTime);
		currentState.grounded = controller.isGrounded;
        
        if (!currentState.grounded && previousState.grounded && currentState.velocity.y < 0) {
            transform.position = previousState.position;
            currentState.velocity.y = currentState.acceleration.y;
            currentState.acceleration.x = 0;
            
            //re-add velocity
            currentState.velocity += currentState.acceleration/2*deltaTime*50;
            ClampVelocity(currentState, input);
            
            //move player again
            controller.Move(currentState.velocity * deltaTime);
            currentState.grounded = controller.isGrounded;
        }
		
		//add half acceleration
		currentState.velocity += currentState.acceleration/2*deltaTime*50;
		ClampVelocity(currentState, input);
		
		//Clamp player onto z = 0
		if (Mathf.Round(transform.position.z*200)/200 != 0) {
			transform.position.x = previousState.position.x;
		}
		transform.position.z = 0;
		currentState.position = transform.position;
		
		//Convert Input to animation weights and state
		if (currentState.grounded) {
			currentState.crouchWeight += input.crouch*deltaTime*CrouchSpeed;
			currentState.standWeight -= input.crouch*deltaTime*CrouchSpeed;
			
			if (input.crouch > 0) {
				//crouching
				currentState.animationState = 2;
			}
			else {
				if (input.sprint && ((input.horizontal < 0 && currentState.rotation < 0.5) || (input.horizontal > 0 && currentState.rotation > 0.5))) {
					//sprinting
					currentState.animationState = 1;
				}
				else {
					//walking/idle
					currentState.animationState = 0;
				}
			}
		}
		else {
			//In air/jumping
			currentState.crouchWeight -= deltaTime*CrouchSpeed;
			currentState.standWeight -= deltaTime*CrouchSpeed;
			currentState.animationState = 3;
		}
		
		currentState.crouchWeight = Mathf.Clamp01(currentState.crouchWeight);
		currentState.standWeight = Mathf.Clamp01(currentState.standWeight);
	}
	
	//Gun
	if (input.switchTo == 0) {
		currentState.selectionWeight -= WeaponSwapSpeed*deltaTime;
	}
	else {
		currentState.selectionWeight += WeaponSwapSpeed*deltaTime;
	}
	currentState.selectionWeight = Mathf.Clamp(currentState.selectionWeight, -1, 1);
	
	if (currentState.selectionWeight < 0) {
		currentState.selected = 0;
	}
	else {
		currentState.selected = 1;
	}
	
	//Convert Input to player rotation
	currentState.rotation += input.rotation*TurnSpeed*deltaTime;
	currentState.rotation = Mathf.Clamp01(currentState.rotation);
	
	nextState = currentState.Copy();
	nextState.timestamp = Time.time + deltaTime;
	
	previousState.timestamp = Time.time;
	nextState.input = input.Copy();
	
	ApplyState(previousState);
	//Appy jump animation on going from ground to air
	if (previousState.grounded && !nextState.grounded) {
		Soldier.animation["RunJump"].time = 0;
		Soldier.animation.Play("RunJump");
	}
	
	//Fall Damage on hit ground
	if (Network.isServer) {
		if (!previousState.grounded && nextState.grounded) {
			if (-previousState.velocity.y*4.2-50 > 0) {
				Damage(-2, -previousState.velocity.y*4.2-50);
			}
		}
		
		if (transform.position.y < networkManager.mapInfo.DeathPlane.position.y) {
			Damage(Mathf.Infinity);
		}
		
		AddLagState(nextState);
	}
	
	return nextState;
}

function ClampVelocity(state:PlayerState, input:InputState) {
	if (state.grounded) {
		if (state.crouchWeight > 0.8) {
			//crouching
			state.velocity.x = Mathf.Clamp(state.velocity.x, -CrouchSpeed, CrouchSpeed);
		}
		else {
			if (input.sprint && ((input.horizontal < 0 && state.rotation < 0.5) || (input.horizontal > 0 && state.rotation > 0.5))) {
				//sprinting
				state.velocity.x = Mathf.Clamp(state.velocity.x, -RunSpeed, RunSpeed);
			}
			else {
				//walking
				state.velocity.x = Mathf.Clamp(state.velocity.x, -WalkSpeed, WalkSpeed);
			}
		}
	}
	else {
		//in air
		state.velocity.x = Mathf.Clamp(state.velocity.x, -RunSpeed, RunSpeed);
	}
}



/*===
Weapon System
===*/

//Returns wether or not a bullet has been fired
function WeaponUpdate(time:float) {
	//State Update
	
	weaponSwitching = (Mathf.Abs(currentState.selectionWeight) != 1);
	
	//Weapon Update
	if (!weaponSwitching) {
		if (weaponTimer < time) {
			if (weaponReloading) {
				if (currentWeapon.SingleBulletReload) {
					if (weaponReloadStage == 0) {
						weaponReloadStage = 1;
					}
					else if (weaponReloadStage == 1) {
						GunFillClip(currentWeapon);
						
						if (currentWeapon.Clip == currentWeapon.ClipSize + currentWeapon.Under[currentWeapon.Addons[2]].ClipAmmoAdd) {
							weaponReloading = false;
						}
						else {
							weaponTimer += currentWeapon.ReloadSpeed;
							return true;
						}
					}
				}
				else {
					GunFillClip(currentWeapon);
					weaponReloading = false;
					Soldier.animation.Stop("StandingReloadM4");
				}
			}
			else if (currentWeapon.Clip == 0) {
				GunStartReload(currentWeapon, time);
			}
			else if (currentWeapon.Type == GunType.Burstfire && weaponBurstCount > 0) {
				GunFire(currentWeapon, time);
                if (weaponBurstCount >= currentWeapon.BurstLength) {
                    weaponBurstCount = 0;
                }
			}
			else if (currentWeapon.ChamberBullet) {
				currentWeapon.BullInCham = true;
			}
		}
	}
	else {
		weaponTimer = time;
		weaponReloadStage = 0;
		weaponBurstCount = 0;
		weaponReloading = false;
		Soldier.animation.Stop("StandingReloadM4");
	}
	return false;
}

function WeaponInput(time:float) {
	return WeaponInputFire(time) || WeaponInputFireDown(time);
}

function WeaponInputFire(time:float) {
	if (!weaponSwitching && 
		!weaponReloading && 
		currentWeapon.Type == GunType.Automatic && 
		currentWeapon.Clip != 0 && 
		currentState.animationState != 1) {
		if (weaponTimer < time) {
			GunFire(currentWeapon, time);
			return true;
		}
	}
	return false;
}

function WeaponInputFireDown(time:float) {
	if (!weaponSwitching && 
		(
			!weaponReloading || (
				currentWeapon.SingleBulletReload && 
				weaponReloadStage == 1
			)
		) && 
		(
			currentWeapon.Type in [GunType.Semiautomatic, GunType.Pumpaction, GunType.Boltaction, GunType.Prefab] || 
			(
				currentWeapon.Type == GunType.Burstfire && 
				weaponBurstCount == 0
			)
		) && 
		currentState.animationState != 1 &&
		currentWeapon.Clip != 0
	) {
		if (weaponTimer < time || (currentWeapon.SingleBulletReload && weaponReloadStage == 1)) {
			weaponReloading = false;
			weaponReloadStage = 0;
			GunFire(currentWeapon, time);
			return true;
		}
	}
	return false;
}

function WeaponFire() {
	GunFire(currentWeapon, Time.time);
}

//Weapon system helpers
function GunFire(gun:Gun, time:float) {
	if (gun.Type == GunType.Prefab){
		if (Network.isServer) {
			rigidTemp = networkManager.InstantiateDynamic(NetId, gun.PrefabIndex, gun.Muzzle.position, Quaternion.identity).GetComponent(Rigidbody);
			rigidTemp.velocity = currentState.velocity;
			
			if (currentState.grounded) {
				rigidTemp.velocity.y = 0;
			}
		}
	}
	else {
		if (Active) {
			networkManager.client._mousePosition = networkManager.client.mousePosition;
			networkManager.client.recoil = gun.Recoil + gun.Front[gun.Addons[1]].RecoilAdd + gun.Under[gun.Addons[2]].RecoilAdd;
			Random.seed = time;
			networkManager.client.recoil.x = Random.Range(networkManager.client.recoil.x, -networkManager.client.recoil.x);
			networkManager.client.recoilWeight = 2;
			networkManager.client.recoilRecoverStart = gun.RecoilRestStart;
			networkManager.client.recoilRecoverEnd = gun.RecoilRestEnd;
		}
		
		//Muzzle Flash
		if (gun.Front[gun.Addons[1]].MuzzleFlashType != -1) {
			IndexList = gun.Front[gun.Addons[1]].MuzzleFlashType;
		}
		else {
			IndexList = gun.MuzzleFlashType;
		}
		Instantiate(networkManager.ShootEffects[IndexList], gun.Muzzle.position, Quaternion.Euler(0, 0, currentState.lookAngle*Mathf.Lerp(1, -1, currentState.rotation))).parent = gun.Muzzle;
		
		//Shoot Bullet
		counter = 0;
		if (gun.Front[gun.Addons[1]].BulletTimes == 0) {
			IndexList = gun.BulletTimes;
		}
		else {
			IndexList = gun.Front[gun.Addons[1]].BulletTimes;
		}
		
		if (gun.Front[gun.Addons[1]].BulletPrefabType != -1) {
			IndexList2 = gun.Front[gun.Addons[1]].BulletPrefabType;
		}
		else {
			IndexList2 = gun.BulletType;
		}
		
		while (counter < IndexList) {
			tmpFloat = GetRandom();
			tmpQuat = Quaternion.Euler(0, 0, tmpFloat*Mathf.Lerp(gun.BulletSpreadHip, gun.BulletSpreadAim, currentState.aimWeight) + currentState.lookAngle*Mathf.Lerp(1, -1, currentState.rotation));
			
			prjt = Instantiate(networkManager.Bullets[IndexList2], gun.Muzzle.position - gun.Muzzle.TransformDirection(Vector3.back)*Mathf.Abs(gun.Muzzle.position.x - transform.position.x), tmpQuat).GetComponent(typeof(Projectile)) as Projectile;
			prjt.gun = gun;
			prjt.NetId = NetId;
			prjt.networkManager = networkManager;
			prjt.Shoot();
			counter += 1;
		}
		
		if (gun.Type == GunType.Burstfire) {
			weaponBurstCount += 1;
		}
		if (gun.ChamberBullet) {
			gun.BullInCham = false;
		}
	}
	
	gun.Clip -= 1;
	weaponTimer = time + gun.FireSpeed;
	
	//Play Audio
	if (gun.Front[gun.Addons[1]].FireSound) {
		audio.PlayClipAtPoint(gun.Front[gun.Addons[1]].FireSound, gun.Muzzle.position);
	}
	else if (gun.FireSound) {
		audio.PlayClipAtPoint(gun.FireSound, gun.Muzzle.position);
	}
	
	//Play Animation
	Soldier.animation["StandingFire"].time = 0;
	Soldier.animation.Play("StandingFire");
}

function WeaponStartReload(time:float) {
	GunStartReload(currentWeapon, time);
}

function GunStartReload(gun:Gun, time:float) {
	if (!weaponSwitching && !weaponReloading && gun.Clip < gun.ClipSize + gun.Under[gun.Addons[2]].ClipAmmoAdd && gun.Ammo > 0) {
		weaponReloading = true;
		if (gun.SingleBulletReload) {
			if (gun.Clip == 0) {
				weaponTimer = time + gun.ReloadStartSpeed;
				weaponReloadStage = 0;
			}
			else {
				weaponTimer = time + gun.ReloadSpeed;
				weaponReloadStage = 1;
			}
		}
		else {
			Soldier.animation.Play("StandingReloadM4");
			if (gun.Clip == 0) {
				weaponTimer = time + gun.ReloadStartEmptySpeed;
			}
			else {
				weaponTimer = time + gun.ReloadStartSpeed;
			}
		}
		
		//server
		if (Network.isClient) {
			networkManager.client.OnReload();
		}
		if (Network.isServer) {
			networkManager.server.OnPlayerReload(NetId);
		}
	}
}

function GunFillClip(gun:Gun) {
	if (gun.Clip < gun.ClipSize + gun.Under[gun.Addons[2]].ClipAmmoAdd) {
		if (gun.Ammo > 0) {
			if (gun.SingleBulletReload) {
				IndexList = 1;
			}
			else {
				IndexList = gun.ClipSize
					+ gun.Under[gun.Addons[2]].ClipAmmoAdd
					- gun.Clip
				;
				
				if (!gun.BullInCham || gun.Clip == 0) {
					IndexList -= 1;
				}
			}
			
			IndexList = Mathf.Min(IndexList, gun.Ammo);
			
			gun.Ammo -= IndexList;
			gun.Clip += IndexList;
		}
	}
}

//Grenade system
//returns wether or not a grenade has been thrown
function ThrowGrenade() {
	if (GrenadeAmmo > 0) {
		if (Network.isServer) {
			rigidTemp = networkManager.InstantiateDynamic(NetId, GrenadeType, transform.position + (Vector3.up*0.2), Quaternion.identity).GetComponent(Rigidbody);
			rigidTemp.velocity = (GreadeThrowStrength * 
				Vector3(
					Mathf.Cos((currentState.lookAngle - 90) * Mathf.Deg2Rad)*
						Mathf.Lerp(-1, 1, currentState.rotation), 
					-Mathf.Sin((currentState.lookAngle - 90) * Mathf.Deg2Rad), 
					0
				)
			);
		}
		else {
			networkManager.network.RPC("_GrenadeThrowRequest", RPCMode.Server, NetId);
		}
		GrenadeAmmo -= 1;
		
		//play animation
		
		return true;
	}
	return false;
}

//Visual
function SetEquipped(Main:int, Secondary:int, gtype:int) {
	GrenadeType = gtype;
	
	equipped = [GunsMain[Main], GunsSecondary[Secondary]];
	equipped[0].Addons = Loadout.gunsMain[Main].Addons;
	equipped[1].Addons = Loadout.gunsSecondary[Secondary].Addons;
	equipped[0].Clip = equipped[0].ClipSize + equipped[0].Front[equipped[0].Addons[1]].ClipAmmoAdd + equipped[0].Under[equipped[0].Addons[2]].ClipAmmoAdd;
	equipped[1].Clip = equipped[1].ClipSize + equipped[1].Front[equipped[1].Addons[1]].ClipAmmoAdd + equipped[1].Under[equipped[1].Addons[2]].ClipAmmoAdd;
    
	for (renderers in (UpperBody.gameObject.GetComponentsInChildren(Renderer) as IEnumerable).Cast.<Renderer>()) {
		renderers.enabled = false;
	}
	
	ShowGun(equipped[0]);
	HideGun(equipped[1]);
}

function SetEquipped(Main:int, Secondary:int, AMain:int[], ASecondary:int[], gtype:int) {
	GrenadeType = gtype;
	
	equipped = [GunsMain[Main], GunsSecondary[Secondary]];
	equipped[0].Addons = AMain;
	equipped[1].Addons = ASecondary;
	equipped[0].Clip = equipped[0].ClipSize + equipped[0].Front[equipped[0].Addons[1]].ClipAmmoAdd + equipped[0].Under[equipped[0].Addons[2]].ClipAmmoAdd;
	equipped[1].Clip = equipped[1].ClipSize + equipped[1].Front[equipped[1].Addons[1]].ClipAmmoAdd + equipped[1].Under[equipped[1].Addons[2]].ClipAmmoAdd;
	for (renderers in (UpperBody.gameObject.GetComponentsInChildren(Renderer) as IEnumerable).Cast.<Renderer>()) {
		renderers.enabled = false;
	}
	
	ShowGun(equipped[0]);
	HideGun(equipped[1]);
}

function ShowGun(gun:Gun) {
	for (renderers in (gun.GunObject.gameObject.GetComponentsInChildren(Renderer) as IEnumerable).Cast.<Renderer>()) {
		renderers.enabled = true;
	}
	
	for (IndexList = 0; IndexList < gun.Sight.length; IndexList += 1) {
		if (IndexList != gun.Addons[0]) {
			for (renderers in (gun.Sight[IndexList].gameObject.GetComponentsInChildren(Renderer) as IEnumerable).Cast.<Renderer>()) {
				renderers.enabled = false;
			}
		}
	}
	
	for (IndexList = 0; IndexList < gun.Front.length; IndexList += 1) {
		if (IndexList != gun.Addons[1]) {
			for (renderers in (gun.Front[IndexList].gameObject.GetComponentsInChildren(Renderer) as IEnumerable).Cast.<Renderer>()) {
				renderers.enabled = false;
			}
		}
	}
	
	for (IndexList = 0; IndexList < gun.Under.length; IndexList += 1) {
		if (IndexList != gun.Addons[2]) {
			for (renderers in (gun.Under[IndexList].gameObject.GetComponentsInChildren(Renderer) as IEnumerable).Cast.<Renderer>()) {
				renderers.enabled = false;
			}
		}
	}
	
	if (gun.Under[gun.Addons[2]].ToggleObject) {
		gun.Under[gun.Addons[2]].ToggleObject.light.enabled = true;
	}
}

function HideGun(gun:Gun) {
	for (renderers in (gun.GunObject.gameObject.GetComponentsInChildren(Renderer) as IEnumerable).Cast.<Renderer>()) {
		renderers.enabled = false;
	}
	
	if (gun.Under[gun.Addons[2]].ToggleObject) {
		gun.Under[gun.Addons[2]].ToggleObject.light.enabled = false;
	}
}

/*===
Server Only
===*/

function AddLagState(state:PlayerState) {
	LagStates.Insert(0, state);
	
	while (LagStates[LagStates.Count - 1].timestamp < Time.time - 2) {
		LagStates.RemoveAt(LagStates.Count - 1);
	}
}

function ApplyLagState(time:float) {
	state1 = nextState;
	state2 = previousState;
	for (IndexList = 0; IndexList < LagStates.Count; IndexList++) {
		if (state1.timestamp > time) {
			break;
		}
        state1 = state2;
        state2 = LagStates[IndexList];
	}
	
	//Interpolate and apply states
	ApplyLagState(PlayerState.Lerp(state1, state2, Mathf.Clamp01((state1.timestamp - time)/(state1.timestamp - state2.timestamp))));
}

function ApplyLagState(state:PlayerState) {
	LagCompensator.position = state.position - Vector3(0, 1, 0);
	
	LagCompensator.animation["Crouch"].enabled = true;
	LagCompensator.animation["Idle"].enabled = true;
	LagCompensator.animation["Crouch"].layer = 1;
	LagCompensator.animation["Idle"].layer = 1;
	
	LagCompensator.animation["Crouch"].speed = 0;
	LagCompensator.animation["Idle"].speed = 0;
	LagCompensator.animation["Crouch"].time = 0;
	LagCompensator.animation["Idle"].time = 0;
	
	LagCompensator.animation["Crouch"].weight = state.crouchWeight;
	LagCompensator.animation["Idle"].weight = state.standWeight;
	
	LagCompensator.eulerAngles.y = Mathf.Lerp(270, 90, state.rotation);
}

}