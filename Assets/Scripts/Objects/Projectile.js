#pragma strict

import System.Collections;

//Projectile Properties
var Speed:float;
var Penetrability:float = 1;
var MaxDistance:float = 1000;

var Explosive:boolean;
var ExplosiveHit:int = 0;

//Reference variables
@System.NonSerialized
var gun:Gun;
@System.NonSerialized
var NetId:int;
@System.NonSerialized
var networkManager:NetworkManager;

//Projectile States
private var percentage:float = 100;
private var startPoint:Vector3;
private var startTime:float;
private var hits:List.<RaycastHit>;

//Iteration/Optimisation
private var nextPoint:Vector3;
private var totalDistance:float;

private var damage:float;
private var hitType:int;
private var parent:boolean;

private var body:BodyCollider;
private var vehicle:VehicleCollider;
private var specialHit:SpecialHit;
private var rb:Rigidbody;
private var sno:StaticNetworkObject;
private var dno:DynamicNetworkObject;
private var penetration:Penetration;

private var obj:Transform;

function Shoot() {
	transform.position.z = 0;
	startPoint = transform.position;
	startTime = Time.time;
	
	hits = new List.<RaycastHit>(
        Physics.RaycastAll(
            startPoint, transform.TransformDirection(Vector3.up), MaxDistance, networkManager.BulletLayerMask
        )
    );
    hits.Sort(SortHits);
}

private function SortHits(hit:RaycastHit, hit2:RaycastHit) {
	return hit.distance.CompareTo(hit2.distance);
}

function Update() {
	nextPoint = transform.position + transform.TransformDirection(Vector3.up)*Speed*Time.deltaTime;
	totalDistance += Speed*Time.deltaTime;
	
	if (hits.Count != 0) {
		while (hits[0].distance < totalDistance) {
			EvalHit(hits[0]);
			hits.RemoveAt(0);
			
			if (hits.Count == 0) {
				break;
			}
		}
	}
	
	if (totalDistance > MaxDistance || percentage <= 0) {
		Destroy(gameObject);
	}
	else {
		transform.position = nextPoint;
	}
}

function EvalHit(hit:RaycastHit) {
	if (hit.collider) {
		//Get Damage
		damage = Mathf.Lerp(gun.MaxDamage, gun.MinDamage,
			Mathf.Clamp01(
				(hit.distance - gun.DamageFalloffStart)/(gun.DamageFalloffEnd - gun.DamageFalloffStart)
			)
		);
		
		//IS RPC
		if (Explosive) {
			try {
				(
					Instantiate(networkManager.BulletHits[ExplosiveHit], hit.point, 
						Quaternion.FromToRotation(Vector3.up, hit.normal)
					).GetComponent(typeof(Explosion)) as Explosion
				).SetId(networkManager, NetId, gun.Name);
			}
			catch (err) {}
			percentage = 0;
		}
		//IS BULLET
		else {
			body = hit.collider.GetComponent(typeof(BodyCollider)) as BodyCollider;
			if (body) {
				if (body.player.NetId != NetId) {
					percentage -= 20*(body.Multi/(Penetrability*Penetrability));
					if (Network.isServer) {
						if (networkManager.NPlayers[body.player.NetId].team != networkManager.NPlayers[NetId].team) {
							body.player.Damage(NetId, damage, body.Multi, gun.Name);
						}
					}
					Hit(0, false, hit);
				}
				return;
			}
			
			hitType = 1;
			parent = false;
			
			specialHit = hit.collider.GetComponent(typeof(SpecialHit)) as SpecialHit;
			if (specialHit) {
				hitType = Mathf.Clamp(specialHit.Type, 0, Mathf.Infinity) + 3;
				parent = specialHit.Parent;
			}
			
			if (Network.isServer) {
				sno = hit.collider.GetComponent(typeof(StaticNetworkObject)) as StaticNetworkObject;
				if (sno) {
					sno.Damage(damage * percentage/100, transform.TransformDirection(Vector3.up)*damage*10, hit.point);
				}
				
				dno = hit.collider.GetComponent(typeof(DynamicNetworkObject)) as DynamicNetworkObject;
				if (dno) {
					dno.Damage(damage * percentage/100, transform.TransformDirection(Vector3.up)*damage*10, hit.point, NetId);
				}
				
				vehicle = hit.collider.GetComponent(typeof(VehicleCollider)) as VehicleCollider;
				if (vehicle) {
					if (!(NetId in vehicle.vehicle.Slots)) {
						if (vehicle.vehicle.team != networkManager.NPlayers[NetId].team) {
							vehicle.vehicle.Damage(NetId, damage/vehicle.vehicle.BulletResistance, vehicle.Multi, gun.Name);
						}
					}
					else {
						return;
					}
				}
			}
			
			penetration = hit.collider.GetComponent(typeof(Penetration)) as Penetration;
			rb = hit.collider.GetComponent(typeof(Rigidbody)) as Rigidbody;
			if (penetration) {
				percentage -= penetration.Percent*(1/(Penetrability*Penetrability));
			}
			else if (rb && !rb.isKinematic) {
				rb.AddForceAtPosition(transform.TransformDirection(Vector3.up)*damage*10, hit.point);
				parent = true;
			}
			else if (!rb) {
				percentage = 0;
			}
			
			Hit(hitType, parent, hit);
		}
	}
}

function Hit(type:int, parnt:boolean, hit:RaycastHit) {
	obj = Instantiate(networkManager.BulletHits[type], hit.point + hit.normal/20, Quaternion.FromToRotation(Vector3.up, hit.normal));
	Random.seed = Time.time;
	obj.position += obj.TransformDirection(Vector3.forward)*Random.Range(-0.3, 0.3);
	if (parnt) {
		obj.parent = hit.transform;
	}
}