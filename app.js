const cluster = require("cluster") 
const { text } = require("express")
const express = require("express")
const request = require("request-promise-native")
const noblox = require("noblox.js")
const { resolve } = require("path")
require("dotenv").config()

Proxies = []

const port = 3000

function downloadProxies(){
    return new Promise(async (resolve, reject) => {
        let proxyData = await request("https://proxy.webshare.io/api/v2/proxy/list/download/jarhwqugojklvicvudccmrbflyrecykzjnwbycef/-/any/username/direct/-/")
        proxyData = proxyData.replace(/(\r\n|\n|\r)/gm, "")
        proxyData = proxyData.replace(/:wowwxhne:xd5b1wmiv59m/g, " ")
        proxyData = proxyData.split(" ")
        Proxies = Object.values(proxyData)
        Proxies.pop(Proxies.length)
        resolve(Proxies)
    })
}

function init(){
    const app = express()
    
    let requestID = 0
    let requestObj = {}

    let proxyCounter = 0
    let Proxies = process.env.Proxies.split(",")
    Proxies = Object.values(Proxies)

    process.on("message", (msg) => {
        if(msg.topic && msg.value){
            console.log(requestObj)
            requestObj[msg.topic].resolve(msg.value)
            delete requestObj[msg.topic]
        }
    })

    function getProxy(reqId){
        return new Promise((resolve, reject) =>{
            requestObj[reqId] = {resolve: resolve}
            process.send({topic: "GETPROXY", value: reqId})
        })
    }

    function incrementCount(){
       // console.log("Incrementing Counter")
        process.send({topic: "INCREMENT"})
    }
    

    app.get("/getData", async (req, res) => {
        if(!req.query.userid || !req.query.username){
            res.send(400)
        }
        let [shirts, gamepasses] = await Promise.all([getShirts(req.query.username), getGamepasses(req.query.userid)])
        console.log(gamepasses)
        let finalPayload = Object.assign(shirts, gamepasses)
        res.send(finalPayload)

    })
    
    app.listen(port, () => {
        console.log("Listening")
    })

    
    function handleErrors(response){
        if(!response.ok){
            throw Error(response.statusText)
        }
        return response
    }

    async function getGamepasses(UserID){
            let universes = []
            let gamepasses = {}

            function getUniverses(){
                return new Promise(async (resolve, reject) => {
                    async function recursiveGetUniverses(UserID, cursor){
                        requestID++
                        let proxy = await getProxy(requestID)
                        let result = await request({
                        url: "https://games.roblox.com/v2/users/"+UserID+"/games?accessFilter=Public&limit=50&cursor="+cursor,
                        proxy: "http://wowwxhne:xd5b1wmiv59m@"+proxy
                        })
                            console.log("Used Proxy ",proxy)
                            incrementCount()
                            result = JSON.parse(result)
                            for(const universe in result.data){
                                universes.push(result.data[universe].id)
                            }
                            if(result.nextPageCursor){
                                recursiveGetUniverses(UserID,result.nextPageCursor)
                            }else{
                                resolve(universes)
                            }
                    }
                    recursiveGetUniverses(UserID, "") 
                })
            }

            async function getGamepassFromUniverses(cursor){
                let universes = await getUniverses()
                console.log("Got Universes ", universes)
                let time = performance.now()
                let Promises = []

                function getGamepassFromPlace(universe){
                    return new Promise((res, rej) =>{
                       async function recursion(cursor){
                            requestID++
                            let proxy = await getProxy(requestID)
                            let data = await request({
                                url: "https://games.roblox.com/v1/games/"+universe+"/game-passes?limit=100&cursor="+cursor,
                                proxy: "http://wowwxhne:xd5b1wmiv59m@"+proxy,
                            })
                            data = JSON.parse(data)
                            for(const gamepass in data.data){
                                if(data.data[gamepass].id == null || data.data[gamepass].price == null){continue}
                                gamepasses[data.data[gamepass].id] = {assetid: 34, price: data.data[gamepass].price}
                            }
                            
                            if(res.nextPageCursor){
                                recursion(res.nextPageCursor)
                            }else{res()}
                        }
                        recursion("")
                    })
                }

                for(const universe of universes){
                    Promises.push(getGamepassFromPlace(universe))
                }

                return new Promise(async (resolve, reject) => {
                    await Promise.all(Promises)
                    resolve(gamepasses)
                }) 
                     
             }
             
            return getGamepassFromUniverses()
             //getGamepassFromUniverses()


        /*
        */

        
    }

    function getShirts(Username){
        return new Promise((resolve, reject) => {
            //console.log("STARTED")
            let shirts = {}
            let cursor = ""
            console.log("SHIRTS ",shirts.length)
            async function recursiveGetShirts(cursor){
                requestID++
                let proxy = await getProxy(requestID)
                let data = await request({
                    url: "https://catalog.roblox.com/v1/search/items/details?Category=3&Limit=30&CreatorName="+Username+"&cursor="+cursor,
                    proxy: "http://wowwxhne:xd5b1wmiv59m@"+proxy
                    })
                    //console.log("Used Proxy ",Proxies[proxyCounter])

                    data = JSON.parse(data)
                    for(const shirt in data.data){
                        shirts[data.data[shirt].id] =  {assetid: 2, price: data.data[shirt].price}
                    }
                    if(data.nextPageCursor){
                        recursiveGetShirts(data.nextPageCursor)
                    }else{
                        resolve(shirts)
                        //console.log("recursion ended")
                    }
                
            }

            recursiveGetShirts(cursor)
        })
        
    }

}

async function appStart(){
    if(cluster.isMaster){
        const cores = require("os").cpus().length
        Proxies = await downloadProxies()

        let proxyCounter = 0
        cluster.on("message", async (worker, msg, handle) => {
            if(msg.topic && msg.value && msg.topic == "GETPROXY"){
                if(proxyCounter==Proxies.length-1){
                    proxyCounter = 0
                }else{proxyCounter++}
                worker.send({
                    topic: msg.value,
                    value: Proxies[proxyCounter]
                })
                console.log("RETURNED VAL ", Proxies[proxyCounter])
            }
        })
        

        for(let i=0; i<cores; i++){
            cluster.fork({Proxies})
        }
    }else{
        init()
    }
}

appStart()
//https://inventory.roblox.com/v2/users/inventory
//"https://games.roblox.com/v2/users/"+UserID+"/games?accessFilter=Public&limit=50&cursor="+cursor

/*
cluster.on("message", (worker, msg, handle) => {
            console.log("Worker ",worker)
            if (msg.topic && msg.topic == "INCREMENT"){
                if(proxyCounter==Proxies.length-1){
                    proxyCounter = 0
                }else{proxyCounter++}

                for(const id in cluster.workers){
                    cluster.workers[id].send({
                        topic: "COUNT",
                        value: proxyCounter
                    })
                }
            }
        })
        */

/*
let data = await request({
                     url: "https://www.roblox.com/users/inventory/list-json?assetTypeId=34&cursor="+cursor+"&itemsPerPage=100&pageNumber=0&userId="+UserID,
                     proxy: "http://wowwxhne:xd5b1wmiv59m@"+Proxies[proxyCounter],
                     headers: {
                         cookie: process.env.COOKIE
                     }
                 })
                    console.log("Request took ", (performance.now() -time)/1000)
                    console.log("Used Proxy ",Proxies[proxyCounter])
                    let res = JSON.parse(data)
                    for(const gamepass in res.Data.Items){
                        if(res.Data.Items[gamepass] == null || res.Data.Items[gamepass].Product == null || res.Data.Items[gamepass].Product.IsForSale == null){continue}
                        if(res.Data.Items[gamepass].Creator.Id == UserID && res.Data.Items[gamepass].Product.IsForSale){
                           // console.log("FOUND A GAMEPASS")
                            gamepasses[res.Data.Items[gamepass].Item.AssetId] = res.Data.Items[gamepass].Product.PriceInRobux
                             
                        }
                        console.log("checked ",gamepass)
                     }
                     incrementCount()
                    // console.log(res.Data)  && !res.Data.Items[gamepass].Product == null
                     if(res.Data.nextPageCursor){
                        //console.log("Getting next page")
                        getGamepassFromUniverses(res.Data.nextPageCursor)
                     }else{
                         resolve(gamepasses)
                     }
                     */