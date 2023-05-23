import axios, { all } from 'axios'
import Entitlement from '../models/Entitlement'
const https = require('https')

const allowSelfSigned = new https.Agent({
    rejectUnauthorized: false
})

const axiosRequestWithPassword = (password: string) => {
    return axios.create({
        httpsAgent: allowSelfSigned,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Basic ' + Buffer.from(`riot:${password}`).toString('base64')
        }
    })
}

const axiosRequestWithEntitlement = (version: string, entitlement: Entitlement) => {
    return axios.create({
        httpsAgent: allowSelfSigned,
        headers: {
            'X-Riot-ClientPlatform': 'ew0KCSJwbGF0Zm9ybVR5cGUiOiAiUEMiLA0KCSJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLA0KCSJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwNCgkicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iDQp9',
            'X-Riot-ClientVersion': version,
            'X-Riot-Entitlements-JWT': entitlement.token,
            'Authorization': 'Bearer ' + entitlement.accessToken
        }
    })
}

const axiosSimple = () => {
    return axios.create({
        httpAgent: allowSelfSigned
    })
}

export { axiosRequestWithPassword, axiosRequestWithEntitlement, axiosSimple }