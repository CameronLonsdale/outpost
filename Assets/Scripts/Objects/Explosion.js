#pragma strict

var Debris:Transform;
var Radius:float;
var RadiusFalloff:float;
var MaxDamage:float;
var ForceDelay:float = 0.3;
private var cols:Collider[];
private var col:Collider;
var Sound:AudioClip;
private var aud:AudioSource;

private var damage:float;
private var distance:float;
private var point:Vector3;

//Hit optimisations
private var player:Player;
private var vehicle:VehicleCollider;
private var rb:Rigidbody;
private var sno:StaticNetworkObject;
private var dno:DynamicNetworkObject;
private var penetration:Penetration;

function Awake() {
	aud = GetComponent(typeof(AudioSource)) as AudioSource;
	
	if (!aud) {
		aud = gameObject.AddComponent(typeof(AudioSource)) as AudioSource;
	}
}

function SetId(nm:NetworkManager, id:int, weapon:String) {
	aud.Play();
	
	cols = Physics.OverlapSphere(transform.position, Radius + RadiusFalloff);
	for (col in cols) {
		//Calculate Damage
		point = col.ClosestPointOnBounds(transform.position);
		distance = Vector3.Distance(transform.position, point);
		
		if (distance > Radius) {
			damage = Mathf.Lerp(MaxDamage, 0, (distance - Radius)/RadiusFalloff);
		}
		else {
			damage = MaxDamage;
		}
		
		//Apply damage
		
		if (Network.isServer) {
			player = col.GetComponent(typeof(Player)) as Player;
			if (player) {
				if (nm.NPlayers[id].team != nm.NPlayers[player.NetId].team || player.NetId == id) {
					player.Damage(id, damage, weapon);
				}
			}
			
			vehicle = col.GetComponent(typeof(VehicleCollider)) as VehicleCollider;
			if (vehicle) {
				if (nm.NPlayers[id].team != vehicle.vehicle.team || (id in vehicle.vehicle.Slots)) {
					vehicle.vehicle.Damage(id, damage, weapon);
				}
			}
			
			sno = col.GetComponent(typeof(StaticNetworkObject)) as StaticNetworkObject;
			if (sno) {
				sno.Damage(damage, (transform.position - point).normalized*damage*10, point);
			}
			dno = col.GetComponent(typeof(DynamicNetworkObject)) as DynamicNetworkObject;
			if (dno) {
				dno.Damage(damage, (transform.position - point).normalized*damage*10, point, id);
			}
		}
		
		if (ForceDelay == 0) {
			if (col.GetComponent(Rigidbody)) {
				col.GetComponent(Rigidbody).AddExplosionForce(MaxDamage*50, transform.position, Radius+RadiusFalloff);
			}
		}
	}
	
	if (ForceDelay > 0) {
		yield WaitForSeconds(ForceDelay);
		
		cols = Physics.OverlapSphere(transform.position, Radius + RadiusFalloff);
		for (col in cols) {
			if (col.GetComponent(Rigidbody)) {
				col.GetComponent(Rigidbody).AddExplosionForce(MaxDamage*50, transform.position, Radius+RadiusFalloff);
			}
		}
	}
}

@script RequireComponent(AudioSource)