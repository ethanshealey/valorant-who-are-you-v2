import fs from 'node:fs'
import Lockfile from '../models/Lockfile'
import { axiosSimple, axiosRequestWithEntitlement, axiosRequestWithPassword } from '../helpers/axiosHelpers'
import User from '../models/User'
import sleep from '../helpers/sleep'
import Entitlement from '../models/Entitlement'
import Match from '../models/Match'
import Player from '../models/Player'

const getClientVersion = async () => {
    const clientVersionPath = `${process.env.LOCALAPPDATA}\\VALORANT\\Saved\\Logs\\ShooterGame.log`
    if(fs.existsSync(clientVersionPath)) {
      let target = fs.readFileSync(clientVersionPath, 'utf8')
      return target.split('\n').find(line => line.includes('CI server version:'))?.split(' ').slice(-1)[0].replaceAll(/(\r\n|\r|\n)/gm, '')
    }
}

const getRegionAndShard = async () => {
    const regionAndShardPath = `${process.env.LOCALAPPDATA}\\VALORANT\\Saved\\Logs\\ShooterGame.log`
    if(fs.existsSync(regionAndShardPath)) {
        let target: any = fs.readFileSync(regionAndShardPath, 'utf8')//, (err, data) => {
        target = target?.split('\n')?.find((line: any) => line.includes('https://glz-'))?.split(' ').find((line: any) => line.includes('https://glz-'))
        // region = target?.split('-')[1]
        // shard = target?.split('-')[2].split('.')[1]
        return { 'region': target?.split('-')[1], 'shard': target?.split('-')[2].split('.')[1] }
    }
}

const getEntitlement = async (lockfile: Lockfile) => {
    const url = `https://127.0.0.1:${lockfile.port}/entitlements/v1/token`
    return axiosRequestWithPassword(lockfile.password).get(url).then((res) => {
        return res.data
    }).catch(console.log)
}

const getLockFile = (cb: Function): void => {

    const lockfilePath = `${process.env.LOCALAPPDATA}\\Riot Games\\Riot Client\\Config\\lockfile`
    let lockfile: Lockfile;

    let inter = setInterval(() => {
        if(fs.existsSync(lockfilePath)) {
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
                lockfile = new Lockfile(lockfileDataArr[0], lockfileDataArr[1], lockfileDataArr[2], lockfileDataArr[3], lockfileDataArr[4], version, rs?.region, rs?.shard)

                clearInterval(inter)
                cb(lockfile)

            })
        }
    }, 1000)

}

const waitForGameToClose = (cb: Function) => {

    const lockfilePath = `${process.env.LOCALAPPDATA}\\Riot Games\\Riot Client\\Config\\lockfile`

    let inter = setInterval(() => {
        if(!fs.existsSync(lockfilePath)) {
            clearInterval(inter)
            cb()
        }
    }, 500)
}

const getUser = async (lockfile: Lockfile, cb: Function) => {
    const url = `https://127.0.0.1:${lockfile.port}/rso-auth/v1/authorization/userinfo`
    const user = new User()
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

const getSelfRank = async (lockfile: Lockfile, puuid: string, entitlement: Entitlement, cb: Function) => {
    const url = `https://pd.${lockfile.shard}.a.pvp.net/mmr/v1/players/${puuid}`
    axiosRequestWithEntitlement(lockfile.version, entitlement).get(url).then((res) => {
        const latestComp = res.data.LatestCompetitiveUpdate.SeasonID
        const queueSkills = res.data.QueueSkills['competitive']
        let rank: string;
        if(queueSkills[latestComp]) {
            rank = queueSkills[latestComp].Rank
        }
        else {
            rank = '0'
        }
        axiosRequestWithEntitlement(lockfile.version, entitlement).get(`https://pd.${lockfile.shard}.a.pvp.net/personalization/v2/players/${puuid}/playerloadout`).then((res) => {
            const card = res.data.Identity.PlayerCardID
            axiosRequestWithEntitlement(lockfile.version, entitlement).get(`https://pd.${lockfile.shard}.a.pvp.net/account-xp/v1/players/${puuid}`).then((res) => {
                const level = res.data.Progress.Level
                cb(rank, card, level)
            }).catch(console.log)
            
        }).catch(console.log)
    }).catch(console.log)
}

const getRank = async (lockfile: Lockfile, puuid: string, entitlement: Entitlement, cb: Function) => {
    const url = `https://pd.${lockfile.shard}.a.pvp.net/mmr/v1/players/${puuid}`
    axiosRequestWithEntitlement(lockfile.version, entitlement).get(url).then((res) => {
        const latestComp = res.data.LatestCompetitiveUpdate.SeasonID
        const queueSkills = res.data.QueueSkills['competitive']
        let rank: Object;
        //
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

const getNameAndTag = async (lockfile: Lockfile, entitlement: Entitlement, puuid: string, cb: Function) => {
    const url = `https://pd.${lockfile.shard}.a.pvp.net/name-service/v2/players`
    axiosRequestWithEntitlement(lockfile.version, entitlement).put(url, [puuid]).then((res) => {
        if(res.data) cb(res.data[0].GameName, res.data[0].TagLine)
        else return cb('', '')
    })
}

const getParties = async (lockfile: Lockfile, allPuuids: string[], cb: Function) => {
    const url = `https://127.0.0.1:${lockfile.port}/chat/v4/presences`
    axiosRequestWithPassword(lockfile.password).get(url).then((res) => {
        // Only keep the player IDs that are in the game
        const presences: any = res.data.presences.filter((player: Player) => allPuuids.includes(player.puuid))
        const partyIDs = {}
        for(const presence of presences) {
            //console.log(JSON.parse(Buffer.from(presence.private, 'base64').toString('utf-8')))
            const puuid: string = presence.puuid
            const party: any = JSON.parse(Buffer.from(presence.private, 'base64').toString('utf-8'))
            const partyId = party.partyId
            const partySize = party.partySize
            if(partySize > 1) {
                if(!(party in partyIDs)) {
                    // @ts-ignore: suppress implicit any errors
                    partyIDs[party] = [ puuid ]
                }
                else {
                    // @ts-ignore: suppress implicit any errors
                    partyIDs[party].push(puuid)
                }
            }
        }
        cb(partyIDs)
    })
}

const checkIfInGame = async (lockfile: Lockfile, entitlement: Entitlement, puuid: string, cb: Function) => {
    let url = `https://glz-${lockfile.region}-1.${lockfile.shard}.a.pvp.net/core-game/v1/players/${puuid}`
    axiosRequestWithEntitlement(lockfile.version, entitlement).get(url).then((res) => {
        url = `https://glz-${lockfile.region}-1.${lockfile.shard}.a.pvp.net/core-game/v1/matches/${res.data.MatchID}`
        axiosRequestWithEntitlement(lockfile.version, entitlement).get(url).then(async (res) => {
            const match: Match = new Match()
            match.map = res.data.MapID
            match.mode = res.data.MatchmakingData.QueueID
            for(const player of res.data.Players) {
                const p: Player = new Player()
                p.character = player.CharacterID
                p.puuid = player.Subject
                p.team = player.TeamID
                p.level = player.PlayerIdentity.AccountLevel
                p.party = 'none'
                await getRank(lockfile, p.puuid, entitlement, (rank: string) => {
                    p.rank = rank
                }).catch(console.log)
                if(player.PlayerIdentity.Incognito) {
                    p.name = '----'
                    p.tag = ' '
                }
                else {
                    await getNameAndTag(lockfile, entitlement, p.puuid, (n: string, t: string) => {
                        p.name = n
                        p.tag = '#' + t
                    }).catch(console.log)
                }
                while(!p.rank || !p.name || !p.tag || !p.character) {
                    await sleep(500)
                }
                // @ts-ignore: suppress implicit any errors
                match[p.team.toLowerCase()].push(p)
            }
            while(match.blue.length + match.red.length < 10) await sleep(500)
            // Get all the player IDs in the match
            const allPuuids = [ ...match.blue.map((player) => player.puuid), ...match.red.map((player) => player.puuid) ]

            let isLoadingParties = true

            const colors = [ '#4685ff', '#dc5856', '#63e96e', '#de6a2b', '#56344c', '#8480fa', '#ed92c8', '#c2d6d1' ]
            let colorIndex = 0;

            await getParties(lockfile, allPuuids, (parties: any) => {
                if(parties) {
                    for(const partyID of Object.keys(parties)) {
                        const playersInParty: string[] = parties[partyID]
                        for(const player of playersInParty) {
                            let index = match.blue.map(p => p.puuid).indexOf(player)
                            if(index > 0)
                                match.blue[index].party = colors[colorIndex]
                            else {
                                index = match.red.map(p => p.puuid).indexOf(player)
                                if(index > 0)
                                    match.red[index].party = colors[colorIndex]
                            }
                        }
                        colorIndex++
                    }
                }
                isLoadingParties = false
            })

            while(isLoadingParties) await sleep(500)

            cb(match)
        }).catch(console.log)
    }).catch((e) => {
        cb({ 'error': 'No Live Game' })
    })
}

export { getLockFile, getUser, getEntitlement, getSelfRank, getRank, checkIfInGame, waitForGameToClose }