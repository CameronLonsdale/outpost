#pragma strict
enum GunType {Automatic, Semiautomatic, Burstfire, Pumpaction, Boltaction, Prefab, Vehicle}
enum GunClass {All, SMG, MG, BattleRifle, AssaultRifle, SniperRifle, Shotgun, Carbine, PDW, All2, MashinePistol, SemiPistol, Revolver, Special}
enum GunClassMain {All=0, SMG=1, MG=2, BattleRifle=3, AssaultRifle=4, SniperRifle=5, Shotgun=6, Carbine=7, PDW=8}
enum GunClassSecondary {All=9, MashinePistol=10, SemiPistol=11, Revolver=12, Special=13}

var Name:String = "";
var Type:GunType;
var Class:GunClass;
var Description:String = "";

var Muzzle:Transform;
var GunObject:Transform;
var MuzzleFlashType:int = 0;
var texture:Texture2D;
var BulletType:int = 0;
var PrefabIndex:int;

var BulletTimes:int = 1;
var BurstLength:int = 3;
var FireSpeed:float;
//var FireAmination:String;
var FireSound:AudioClip;
/*
var IdleAnimationHip:String;
var IdleAnimationAim:String;
var IdleAnimationBored:String;
var IdleAnimationOff:String;*/

var SingleBulletReload:boolean = false;

var ReloadStartSpeed:float;
var ReloadStartEmptySpeed:float;
var ReloadSpeed:float;
var ReloadEndSpeed:float;
/*var ReloadStartAnimation:String;
var ReloadAnimation:String;
var ReloadEndAnimation:String;
var ReloadStartSound:AudioClip;
var ReloadSound:AudioClip;
var ReloadEndSound:AudioClip;*/

var MaxDamage:float;
var MinDamage:float;
var DamageFalloffStart:float;
var DamageFalloffEnd:float;

var ClipSize:int;
var ChamberBullet:boolean = false;
var AmmoMax:int;

var Recoil:Vector2;
var RecoilRestStart:float;
var RecoilRestEnd:float;

var BulletSpreadHip:float;
var BulletSpreadAim:float;

var Sight:GunAddon[];
var Front:GunAddon[];
var Under:GunAddon[];

@System.NonSerialized
var Addons:int[] = new int[3];
@System.NonSerialized
var index:int;
@System.NonSerialized
var Clip:int;
@System.NonSerialized
var Ammo:int;
@System.NonSerialized
var BullInCham:boolean = true;

function Awake() {
	Clip = ClipSize;
	Ammo = AmmoMax;
}