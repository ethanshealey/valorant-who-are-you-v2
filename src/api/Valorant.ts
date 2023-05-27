import fs from 'node:fs'
import Lockfile from '../models/Lockfile'
import { axiosSimple, axiosRequestWithEntitlement, axiosRequestWithPassword } from '../helpers/axiosHelpers'
import User from '../models/User'
import sleep from '../helpers/sleep'
import Entitlement from '../models/Entitlement'
import Match from '../models/Match'
import Player from '../models/Player'

/**
 * 
 * Valorant.ts
 * 
 * This file manages all API calls made to the internal VALORANT API
 * All methods in this program:
 *  - getClientVersion()
 *  - getRegionAndShard()
 *  - getEntitlement()
 *  - getLockFile()
 *  - waitForGameToClose()
 *  - getUser()
 *  - getSelfRank()
 *  - getRank()
 *  - getNameAndTag()
 *  - getParties()
 *  - checkIfInGame()
 * 
 */

/**
 * getClientVersion()
 *  
 * Retrieves the client version from the ShooterGame log file in order to 
 * properly call some of the endpoints
 * 
 * @returns client version, as a string
 */
const getClientVersion = async () => {
    const clientVersionPath = `${process.env.LOCALAPPDATA}\\VALORANT\\Saved\\Logs\\ShooterGame.log`
    // Parse the client version from the ShooterGame.log file
    if(fs.existsSync(clientVersionPath)) {
      let target = fs.readFileSync(clientVersionPath, 'utf8')
      return target.split('\n').find(line => line.includes('CI server version:'))?.split(' ').slice(-1)[0].replaceAll(/(\r\n|\r|\n)/gm, '')
    }
}

/**
 * getRegionAndShard()
 * 
 * Retrieves the region and shard from the ShooterGame log file in order to
 * properly call some of the endpoints
 * 
 * @returns region, shard as strings
 */
const getRegionAndShard = async () => {
    const regionAndShardPath = `${process.env.LOCALAPPDATA}\\VALORANT\\Saved\\Logs\\ShooterGame.log`
    // Parse the region and shard from the ShooterGame.log file
    if(fs.existsSync(regionAndShardPath)) {
        let target: any = fs.readFileSync(regionAndShardPath, 'utf8')//, (err, data) => {
        target = target?.split('\n')?.find((line: any) => line.includes('https://glz-'))?.split(' ').find((line: any) => line.includes('https://glz-'))
        return { 'region': target?.split('-')[1], 'shard': target?.split('-')[2].split('.')[1] }
    }
}

/**
 * getEntitlement()
 * 
 * Refreshes authentication for the API
 * 
 * @param lockfile 
 * @returns entitlement data
 */
const getEntitlement = async (lockfile: Lockfile) => {
    const url = `https://127.0.0.1:${lockfile.port}/entitlements/v1/token`
    // Request authentication from the internal API
    return axiosRequestWithPassword(lockfile.password).get(url).then((res) => {
        return res.data
    }).catch(console.log)
}

/**
 * getLockFile()
 * 
 * Waits for the lockfile to exist which indicates the game has been launched
 * 
 * @param cb: a callback function that handles the response
 */
const getLockFile = (cb: Function): void => {

    const lockfilePath = `${process.env.LOCALAPPDATA}\\Riot Games\\Riot Client\\Config\\lockfile`
    let lockfile: Lockfile;

    // Every second, check if the lockfile has been created yet
    let inter = setInterval(() => {
        if(fs.existsSync(lockfilePath)) {
            // if the lockfile is found, then read and parse its data
            fs.readFile(lockfilePath, 'utf8', async (err, data) => {
                // handle any errors
                if(err) {
                    console.error(err)
                    return
                }

                const version = await getClientVersion()
                const rs = await getRegionAndShard()

                while(!version) sleep(500)

                const lockfileDataArr = data.split(':')
                /**
                 * The lockfile consist of:
                 *  - name
                 *  - pid
                 *  - port
                 *  - password
                 *  - protocol
                 */
                lockfile = new Lockfile(lockfileDataArr[0], lockfileDataArr[1], lockfileDataArr[2], lockfileDataArr[3], lockfileDataArr[4], version, rs?.region, rs?.shard)

                clearInterval(inter)
                cb(lockfile)

            })
        }
    }, 1000)

}

/**
 * waitForGameToClose()
 * 
 * The opposite of getLockFile, waits for the lockfile to no longer exits
 * in order to tell when the game closes
 * 
 * @param cb: a callback function that handles the response
 */
const waitForGameToClose = (cb: Function) => {

    const lockfilePath = `${process.env.LOCALAPPDATA}\\Riot Games\\Riot Client\\Config\\lockfile`

    // every half second, check if lockfile no longer exists
    let inter = setInterval(() => {
        if(!fs.existsSync(lockfilePath)) {
            clearInterval(inter)
            cb()
        }
    }, 500)
}

/**
 * getUser()
 * 
 * Gets the currently logged in user and their information
 * 
 * @param lockfile: the lockfile
 * @param cb: a callback function to handle the user object
 */
const getUser = async (lockfile: Lockfile, cb: Function) => {
    const url = `https://127.0.0.1:${lockfile.port}/rso-auth/v1/authorization/userinfo`
    const user = new User()

    // Request user information from internal API and populate the User object
    axiosRequestWithPassword(lockfile.password).get(url).then(async (res) => {
        const temp = JSON.parse(res.data.userInfo)
        user.name = temp.acct.game_name
        user.tag = temp.acct.tag_line
        user.puuid = temp.sub
        user.country = temp.country
        user.player_locale = temp.player_locale
        cb(user)
    }).catch((e) => {
        console.log(e)
        getUser(lockfile, cb)
    })
}

/**
 * getSelfRank()
 * 
 * Gets the logged in users stats
 * 
 * @param lockfile: the lockfile
 * @param puuid: the players puuid
 * @param entitlement: authentication
 * @param cb: a callback function to handle the users stats
 */
const getSelfRank = async (lockfile: Lockfile, puuid: string, entitlement: Entitlement, cb: Function) => {
    const url = `https://pd.${lockfile.shard ?? 'na'}.a.pvp.net/mmr/v1/players/${puuid}`

    // Request the current users rank and stats to display on the home screen
    axiosRequestWithEntitlement(lockfile.version, entitlement).get(url).then((res) => {
        const latestComp = res.data.LatestCompetitiveUpdate.SeasonID
        const queueSkills = res.data.QueueSkills['competitive']
        let rank: string;

        // Check if the user has played this current season
        // If they have then you can get their current rank
        // using the queueSkills data, if they have not played
        // then you can default to 0, being 'unrated'
        if(queueSkills[latestComp]) {
            rank = queueSkills[latestComp].CompetitiveTier
        }
        else {
            rank = '0'
        }

        // Get the users player card to display on the home screen
        axiosRequestWithEntitlement(lockfile.version, entitlement).get(`https://pd.${lockfile.shard ?? 'na'}.a.pvp.net/personalization/v2/players/${puuid}/playerloadout`).then((res) => {
            const card = res.data.Identity.PlayerCardID
            // Get the users level to display on the home screen
            axiosRequestWithEntitlement(lockfile.version, entitlement).get(`https://pd.${lockfile.shard ?? 'na'}.a.pvp.net/account-xp/v1/players/${puuid}`).then((res) => {
                const level = res.data.Progress.Level
                cb(rank, card, level)
            }).catch(console.log)
            
        }).catch(console.log)
    }).catch(console.log)
}

/**
 * getRank()
 * 
 * Gets the stats of a player as specified with `puuid`
 * 
 * @param lockfile: the lockfile
 * @param puuid : the target players unique ID
 * @param entitlement : authentication
 * @param cb : a callback function to handle player stats
 */
const getRank = async (lockfile: Lockfile, puuid: string, entitlement: Entitlement, cb: Function) => {
    const url = `https://pd.${lockfile.shard ?? 'na'}.a.pvp.net/mmr/v1/players/${puuid}`

    // Get a players rank using their PUUID
    axiosRequestWithEntitlement(lockfile.version, entitlement).get(url).then((res) => {
        const latestComp = res.data.LatestCompetitiveUpdate.SeasonID
        const queueSkills = res.data.QueueSkills['competitive']
        let rank: Object;
        
        // Check if the user has played this current season
        // If they have then you can get their current rank
        // using the queueSkills data, if they have not played
        // then you can default to 0, being 'unrated'
        if(queueSkills.SeasonalInfoBySeasonID) {
            if(Object.keys(queueSkills.SeasonalInfoBySeasonID).includes(latestComp)) {
                rank = queueSkills.SeasonalInfoBySeasonID[latestComp]
            }
            else {
                rank = { CompetitiveTier: '0' }
            }
        }
        else
            rank = { CompetitiveTier: '0' }
        
        cb(rank)
    }).catch(console.log)
}

/**
 * getNameAndTag()
 * 
 * Gets the target players name and tag as specified by `puuid`
 * 
 * @param lockfile : the lockfile
 * @param entitlement : authentication
 * @param puuid : target players unique ID
 * @param cb : a callback function to handle response
 */
const getNameAndTag = async (lockfile: Lockfile, entitlement: Entitlement, puuid: string, cb: Function) => {
    const url = `https://pd.${lockfile.shard ?? 'na'}.a.pvp.net/name-service/v2/players`
    // Requests a players name and tag using their PUUID
    axiosRequestWithEntitlement(lockfile.version, entitlement).put(url, [puuid]).then((res) => {
        // if the user does not hide their name, then return it. Else return blanks
        if(res.data) cb(res.data[0].GameName, res.data[0].TagLine)
        else return cb('', '')
    })
}

/**
 * getParties()
 * 
 * Gets the parties from a users current game
 * 
 * @param lockfile : the lockfile
 * @param allPuuids : a list of all the players unique IDs
 * @param cb : a callback function to handle the response
 */
const getParties = async (lockfile: Lockfile, allPuuids: string[], cb: Function) => {
    const url = `https://127.0.0.1:${lockfile.port}/chat/v4/presences`
    // Requests the parties currently in a players game 
    axiosRequestWithPassword(lockfile.password).get(url).then((res) => {
        // Only keep the player IDs that are in the game
        const presences: any = res.data.presences.filter((player: Player) => allPuuids.includes(player.puuid))
        const partyIDs = {}
        // For each player:
        //  - Get the users party
        //  - If the party has a size > 2:
        //      - Save the party information
        for(const presence of presences) {
            const puuid: string = presence.puuid
            const party: any = JSON.parse(Buffer.from(presence.private, 'base64').toString('utf-8'))
            const partyId = party.partyId
            const partySize = party.partySize
            if(partySize > 1) {
                console.log(partyId, partySize)
                if(!(partyId in partyIDs)) {
                    // @ts-ignore: suppress implicit any errors
                    partyIDs[partyId] = [ puuid ]
                }
                else {
                    // @ts-ignore: suppress implicit any errors
                    partyIDs[partyId].push(puuid)
                }
            }
        }
        cb(partyIDs)
    })
}

/**
 * checkIfInGame()
 * 
 * Checks if user is current in a game
 * 
 * If a player is NOT in a game, then return an object that consist of an error with the value 'No Live Game'
 * Else if a player IS in a game, then return the Match object
 * 
 * @param lockfile : the lockfile
 * @param entitlement : authentication
 * @param puuid : users unique ID
 * @param prevMatchId : the previous match ID
 * @param cb : a callback function to handle the response
 */
const checkIfInGame = async (lockfile: Lockfile, entitlement: Entitlement, puuid: string, prevMatchId: string, cb: Function) => {
    let url = `https://glz-${lockfile.region}-1.${lockfile.shard ?? 'na'}.a.pvp.net/core-game/v1/players/${puuid}`
    // Attempt to get the players current game
    // @NOTE: If the player is not in game, it will throw an exception
    //        use a catch block to instead send back an error message to tell the
    //        app not to change views yet
    axiosRequestWithEntitlement(lockfile.version, entitlement).get(url).then((res) => {
        const matchId = res.data.MatchID
        // If the match is the same as previously obtained, ignore
        if(matchId !== prevMatchId) {
            url = `https://glz-${lockfile.region}-1.${lockfile.shard ?? 'na'}.a.pvp.net/core-game/v1/matches/${matchId}`
            // Get the match data and store in a Match object
            axiosRequestWithEntitlement(lockfile.version, entitlement).get(url).then(async (res) => {
                const match: Match = new Match()
                match.id = matchId
                match.map = res.data.MapID
                match.mode = res.data.MatchmakingData.QueueID
                // For each player in the lobby ->
                for(const player of res.data.Players) {
                    const p: Player = new Player()
                    p.character = player.CharacterID
                    p.puuid = player.Subject
                    p.team = player.TeamID
                    p.level = player.PlayerIdentity.AccountLevel
                    p.party = 'none'
                    // Get the players rank
                    await getRank(lockfile, p.puuid, entitlement, (rank: string) => {
                        p.rank = rank
                    }).catch(console.log)
                    // If the player is hiding their name, replace their name with dashes
                    if(player.PlayerIdentity.Incognito) {
                        p.name = '----'
                        p.tag = ' '
                    }
                    else {
                        // If player is not hiding name, then get it
                        await getNameAndTag(lockfile, entitlement, p.puuid, (n: string, t: string) => {
                            p.name = n
                            p.tag = '#' + t
                        }).catch(console.log)
                    }
                    // wait for all values to get populated before proceeding 
                    while(!p.rank || !p.name || !p.tag || !p.character) {
                        await sleep(500)
                    }
                    // Add the player to the match object
                    // @ts-ignore: suppress implicit any errors
                    match[p.team.toLowerCase()].push(p)
                }

                // Wait for atleast 10 players to load before proceeding
                while(match.blue.length + match.red.length < 10) await sleep(500)

                // Get all the player IDs in the match
                const allPuuids = [ ...match.blue.map((player) => player.puuid), ...match.red.map((player) => player.puuid) ]

                let isLoadingParties = true

                const colors = [ '#4685ff', '#dc5856', '#63e96e', '#f59622', '#56344c', '#8480fa', '#ed92c8', '#c2d6d1' ]
                let colorIndex = 0;

                // Get the parties currently in the lobby
                await getParties(lockfile, allPuuids, (parties: any) => {
                    if(parties) {
                        // For each party ->
                        for(const partyID of Object.keys(parties)) {
                            const playersInParty: string[] = parties[partyID]
                            // For each player in the party ->
                            for(const player of playersInParty) {
                                // Find if player is in blue team or red team, then add the 
                                // party attribute to their object
                                let index = match.blue.map(p => p.puuid).indexOf(player)
                                if(index >= 0) 
                                    match.blue[index].party = colors[colorIndex]
                                else {
                                    index = match.red.map(p => p.puuid).indexOf(player)
                                    if(index >= 0) 
                                        match.red[index].party = colors[colorIndex]
                                }
                            }
                            colorIndex++
                        }
                    }
                    isLoadingParties = false
                })

                // wait for parties to load before proceeding
                while(isLoadingParties) await sleep(500)

                cb(match)
            }).catch(console.log)
        }
    }).catch((e) => {
        cb({ 'error': 'No Live Game' })
    })
}

export { getLockFile, getUser, getEntitlement, getSelfRank, getRank, checkIfInGame, waitForGameToClose }