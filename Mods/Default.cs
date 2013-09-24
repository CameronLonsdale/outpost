class Default {
    
    /* - game timers
    startTime - the amount of time between the map loading and the game starting
    respawnTime - the total amount of time until respawn
    deathTime - the amount of time the killCam should show after death (should be less than respawn)
    winTime - the amount of time the win screen will show
    postTime - the amount of time the post-game screen will show
    */
    
    public float startTime;
    public float respawnTime;
    public float deathTime;
    public float winTime;
    public float postTime;
    
    /* - game mode
    0 = TDM
    1 = KOTH
    2 = CP
    3 = Gun Master
    */
    
    public int gameMode;
    
    /* - map
    0 = Bomb Building
    */
    
    public int map;
    
    /* - target kills
    5 < target kills < 1000
    */
    
    public int targetKills;
    
    //End of each game
    public void OnGameEnd() {
    }
}