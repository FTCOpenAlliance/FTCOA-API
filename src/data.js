import Constants from "./config"

export default class Data {

    static async getAllTeamData(program, teamNumber, db) {
        
        if (isNaN(teamNumber)) {
            return {
                data: null,
                error: "Team Number Invalid.",
                statusCode: 400,
                contentType: new Headers({"Content-Type": "text/plain"})
            }
        }

        let teamID;

        if (program.toLowerCase() === "ftc") {
            teamID = "FTC" + teamNumber.toString()
        } else if (program.toLowerCase() === "frc") {
            teamID = "FRC" + teamNumber.toString()
        } else {
            return {
                data: null,
                error: "Program Invalid.",
                statusCode: 400,
                contentType: new Headers({"Content-Type": "text/plain"})
            }
        }

        let data = await db.prepare(`
            SELECT SUBSTR(Teams.TeamID, 4) AS TeamNumber, * FROM Teams
            LEFT JOIN TeamLinks ON Teams.TeamID = TeamLinks.TeamID
            LEFT JOIN TeamInfo ON Teams.TeamID = TeamInfo.TeamID
            LEFT JOIN RobotInfo ON Teams.TeamID = RobotInfo.TeamID
            LEFT JOIN CodeInfo ON Teams.TeamID = CodeInfo.TeamID
            LEFT JOIN FreeResponse ON Teams.TeamID = FreeResponse.TeamID
            WHERE Teams.TeamID IS ?
            `)
        .bind(teamID)
        .run()

        let awardData = await db.prepare("SELECT TeamAwards.Award, TeamAwards.Year FROM TeamAwards WHERE TeamID IS ?")
        .bind(teamID)
        .run()

        if (data.results.length == 0) {
            return {
                data: null,
                error: "Team does not exist on the Open Alliance.",
                statusCode: 500,
                contentType: new Headers({"Content-Type": "text/plain"})
            }
        }
    
        //Parse Array Data
        for (const key in data.results[0]) {
            if (Constants.arrayData.includes(key)) {
                data.results[0][key] = JSON.parse(data.results[0][key])
            }
        }
    
        data.results[0]["Awards"] = awardData.results.sort((a, b) => a.Year - b.Year) || []
    
        return {
            data: data.results[0],
            error: null,
            statusCode: 200,
            contentType: new Headers({"Content-Type": "application/json"}),
        }
        
    }

    static async getTeamData(program, teamNumber, db) {

        if (isNaN(teamNumber)) {
            return {
                data: null,
                error: "Team Number Invalid.",
                statusCode: 400,
                contentType: new Headers({"Content-Type": "text/plain"})
            }
        }

        let teamID;

        if (program.toLowerCase() === "ftc") {
            teamID = "FTC" + teamNumber.toString()
        } else if (program.toLowerCase() === "frc") {
            teamID = "FRC" + teamNumber.toString()
        } else {
            return {
                data: null,
                error: "Program Invalid.",
                statusCode: 400,
                contentType: new Headers({"Content-Type": "text/plain"})
            }
        }

        let data = await db.prepare("SELECT SUBSTR(Teams.TeamID, 4) AS TeamNumber, * FROM Teams LEFT JOIN TeamLinks ON Teams.TeamID = TeamLinks.TeamID WHERE Teams.TeamID IS ?")
            .bind(teamID)
            .run()
        
        if (data.results.length == 0) {
            return {
                data: null,
                error: "Team does not exist on the Open Alliance.",
                statusCode: 400,
                contentType: new Headers({"Content-Type": "text/plain"})
            }
        }
        
        return {
                data: data.results[0],
                error: null,
                statusCode: 200,
                contentType: new Headers({"Content-Type": "application/json"})
        }
    }

    static async getTeamList(program, db) {

        if (program.toLowerCase() === "ftc") {
            program = "FTC"
        } else if (program.toLowerCase() === "frc") {
            program = "FRC"
        } else {
            return {
                data: null,
                error: "Program Invalid.",
                statusCode: 400,
                contentType: new Headers({"Content-Type": "text/plain"})
            }
        }

        let data = await db.prepare(`
        SELECT SUBSTR(Teams.TeamID, 4) AS TeamNumber, Teams.*, TeamLinks.*, NAward.NewestAwardYear, NAward.NewestAward FROM Teams
        LEFT JOIN TeamLinks ON Teams.TeamID = TeamLinks.TeamID
        LEFT JOIN (SELECT TeamAwards.TeamID, MAX(TeamAwards.Year) AS NewestAwardYear, TeamAwards.Award AS NewestAward FROM TeamAwards GROUP BY TeamAwards.TeamID) AS NAward ON Teams.TeamID = NAward.TeamID
        WHERE Teams.TeamID LIKE ?
        `)
        .bind(`${program}%`)
        .run()

        return {
            data: data.results.sort((a, b) => a.TeamNumber - b.TeamNumber),
            error: null,
            statusCode: 200,
            contentType: new Headers({"Content-Type": "application/json"})
        }
    }

    static async getTeamStats(program, db) {
        let uncountedData = {}
        
        let returnData = {}
    
        let numTeams = 0

        if (program.toLowerCase() === "ftc") {
            program = "FTC"
        } else if (program.toLowerCase() === "frc") {
            program = "FRC"
        } else {
            return {
                data: null,
                error: "Program Invalid.",
                statusCode: 400,
                contentType: new Headers({"Content-Type": "text/plain"})
            }
        }
    
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
            let dbData = await db.prepare(`SELECT ${columnNames.join(', ')} FROM ${table} WHERE ${table}.TeamID LIKE ?`)
            .bind(`${program}%`)
            .run()
            numTeams = dbData.results.length
    
            //For every column of every entry, check if it is an array.
            //If it is, add every element to the respective array.
            //Otherwise, simply add the value to the array directly.
            dbData.results.forEach((entry) => {
                columnNames.forEach((column) => {
                    //Only separate by Country for Location
                    if (table == "Teams" && column == "Location") {
                        entry[column] = entry[column].split(", ")[2] ?? ""
                    }
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