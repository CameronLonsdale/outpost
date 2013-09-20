#pragma strict

class BlenderImportDefaults extends AssetPostprocessor {
	function OnPreprocessModel() {
		if (!assetPath.Contains("-a") && assetPath.Contains(".blend")) {
			var modelImporter:ModelImporter = assetImporter as ModelImporter;
			
			modelImporter.importMaterials = false;
			modelImporter.generateSecondaryUV = true;
			modelImporter.animationType = ModelImporterAnimationType.None;
			//modelImporter.importAnimation = false;
		}
	}
}