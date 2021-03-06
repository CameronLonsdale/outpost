#pragma strict

import System.IO;

class MapInfoUpdater extends AssetModificationProcessor {
	static function OnWillSaveAssets(paths:String[]):String[] {
		// Get the name of the scene to save.
		var scenePath:String = "";
		var sceneName:String = "";
		
		for (var path:String in paths) {
				if(path.Contains(".unity")) {
					scenePath = Path.GetDirectoryName(path);
					sceneName = Path.GetFileNameWithoutExtension(path);
				}
		}
		
		if(sceneName.Length == 0) {
			return paths;
		}
		
		var mapInfo:MapInfo = UnityEngine.Object.FindObjectOfType(typeof(MapInfo)) as MapInfo;
		if (mapInfo) {
			mapInfo.UpdateReferences();
		}
		
		return paths;
	}
}