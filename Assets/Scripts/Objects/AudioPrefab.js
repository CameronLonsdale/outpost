#pragma strict

function Update () {
	if (!audio.isPlaying) {
		Destroy(gameObject);
	}
}