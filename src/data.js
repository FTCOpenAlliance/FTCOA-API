import Constants from "./config"

export default class Data {

    static async getAllTeamData(teamNumber, db) {
    
        let returnData = {}
    
        if (isNaN(teamNumber)) {
            return {
                data: null,
                error: "Team Number Invalid.",
                statusCode: 400,
                contentType: new Headers({"Content-Type": "text/plain"})
            }
        }
        
        let data = await db.prepare(`
            SELECT Teams.*, TeamLinks.*, TeamInfo.*, RobotInfo.*, CodeInfo.*, FreeResponse.* FROM Teams
            LEFT JOIN TeamLinks ON Teams.TeamNumber = TeamLinks.TeamNumber
            LEFT JOIN TeamInfo ON Teams.TeamNumber = TeamInfo.TeamNumber
            LEFT JOIN RobotInfo ON Teams.TeamNumber = RobotInfo.TeamNumber
            LEFT JOIN CodeInfo ON Teams.TeamNumber = CodeInfo.TeamNumber
            LEFT JOIN FreeResponse ON Teams.TeamNumber = FreeResponse.TeamNumber
            WHERE Teams.TeamNumber IS ?
            `)
        .bind(teamNumber)
        .run()
    
        let awardData = await db.prepare("SELECT TeamAwards.Award, TeamAwards.Year FROM TeamAwards WHERE TeamNumber IS ?")
        .bind(teamNumber)
        .run()
        
        if (data.results.length == 0) {
            return {
                data: null,
                error: "Team Does Not Exist on Open Alliance.",
                statusCode: 500,
                contentType: new Headers({"Content-Type": "text/plain"})
            }
        }
    
        returnData = data.results[0]
    
        //Parse Array Data
        for (const key in data.results[0]) {
            if (Constants.arrayData.includes(key)) {
                returnData[key] = JSON.parse(returnData[key])
            }
        }
    
        returnData["Awards"] = awardData.results.sort((a, b) => a.Year - b.Year) || []
    
        return {
            data: data.results,
            error: null,
            statusCode: 200,
            contentType: new Headers({"Content-Type": "application/json"}),
        }
        
    }

    static async getTeamData(teamNumber, db) {
        let data = await db.prepare("SELECT * FROM Teams LEFT JOIN TeamLinks ON Teams.TeamNumber = TeamLinks.TeamNumber WHERE Teams.TeamNumber IS ?")
            .bind(teamNumber)
            .run()
        
        if (data.results.length == 0) {
            return {
                data: null,
                error: "Team Does Not Exist.",
                statusCode: 400,
                contentType: new Headers({"Content-Type": "text/plain"})
            }
        }
        
        return {
                data: data.results,
                error: null,
                statusCode: 200,
                contentType: new Headers({"Content-Type": "application/json"})
        }
    }

    static async getTeamList(db) {
        let data = await db.prepare(`
        SELECT Teams.*, TeamLinks.*, NAward.NewestAwardYear, NAward.NewestAward FROM Teams
        LEFT JOIN TeamLinks ON Teams.TeamNumber = TeamLinks.TeamNumber
        LEFT JOIN (SELECT TeamAwards.TeamNumber, MAX(TeamAwards.Year) AS NewestAwardYear, TeamAwards.Award AS NewestAward FROM TeamAwards GROUP BY TeamAwards.TeamNumber) AS NAward ON Teams.TeamNumber = NAward.TeamNumber
        `).run()
    
        return {
            data: data.results,
            error: null,
            statusCode: 200,
            contentType: new Headers({"Content-Type": "application/json"})
        }
    }

    static async getTeamStats(db) {
        let uncountedData = {}
        
        let returnData = {}
    
        let numTeams = 0
    
        //Loop through the tables specified in the JSON Object
        for (const table of Object.keys(Constants.statsSchema)) { 
    
            //Get the list of columns for the current table
            let columnNames = Constants.statsSchema[table]
    
            //Make a new empty array for each column in both objects.
            columnNames.forEach((column) => {
                uncountedData[column] = []
                returnData[column] = []
            })
    
            //DB Query
            let dbData = await db.prepare(`SELECT ${columnNames.join(', ')} FROM ${table}`).run()
    
            numTeams = dbData.results.length
    
            //For every column of every entry, check if it is an array.
            //If it is, add every element to the respective array.
            //Otherwise, simply add the value to the array directly.
            dbData.results.forEach((entry) => {
                columnNames.forEach((column) => {
                    try {
                        if (Array.isArray(JSON.parse(entry[column]))) {
                            JSON.parse(entry[column]).forEach((option) => {
                                uncountedData[column].push(option)
                            })
                        }
                    } catch (error) {
                        uncountedData[column].push(entry[column])
                    }
                })
            })
        }
    
        //Loop over every statistic
        Object.keys(uncountedData).forEach((stat) => {
    
            //For every unique statistic, add an object to the results array that contains it's name and count.
            //(Formatted for Apache ECharts)
            ([...new Set(uncountedData[stat])]).forEach((uniqueAnswer) => {
                returnData[stat].push(
                    {
                        name: uniqueAnswer,
                        value: uncountedData[stat].filter(x => x === uniqueAnswer).length
                    }
                        
                )
            })
    
        })
    
        returnData.NumTeams = numTeams
    
        return {
            data: returnData,
            error: null,
            statusCode: 200,
            contentType: new Headers({"Content-Type": "application/json"})
        }
    }
}