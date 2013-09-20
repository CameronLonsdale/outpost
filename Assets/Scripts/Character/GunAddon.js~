#pragma strict
/*
Gun Addons:
Sights:
	Iron sight (x1)
	Acog (x4)
	Ballistics (x8)
	reflex (x1.5)
	Holo (x2)
Front:
	Silencer -spread, -damage, diff sound
	MuzzleSupressor +spread, -recoil, diff flash
	HeavyBarrel -Aim Spread, +Hip Spread, +Recoil
	StreightPullBolt -Fire Speed, readload while aimed
	None
Under:
	Foregrip +Aim Spread, -Hip Spread, -Recoil
	Lazer -Hip Spread
	Flashlight
	ExtendedMags +Clip Ammo, -Max Ammo
	None
*/

var Name:String = "None";
var Description:String;
var texture:Texture2D;
var BulletTimes:int = 0;
var BulletPrefabType:int = -1;
var MuzzleFlashType:int = -1;
var RecoilAdd:Vector2 = Vector2.zero;
var AccuracyAimAdd:float = 0;
var AccuracyHipAdd:float = 0;
var SpreadAddAdd:float = 0;
var DamageAdd:float = 0;
var VewDistance:float = 0;
var ClipAmmoAdd:int;
var MaxAmmoAdd:int;
var FireSound:AudioClip;
var ToggleObject:Transform;