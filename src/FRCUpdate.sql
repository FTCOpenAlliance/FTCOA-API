/* Rename existing tables to [tablename]_old */
ALTER TABLE Teams RENAME TO Teams_old;
ALTER TABLE TeamLinks RENAME TO TeamLinks_old;
ALTER TABLE TeamInfo RENAME TO TeamInfo_old;
ALTER TABLE RobotInfo RENAME TO RobotInfo_old;
ALTER TABLE CodeInfo RENAME TO CodeInfo_old;
ALTER TABLE FreeResponse RENAME TO FreeResponse_old;
ALTER TABLE TeamAwards RENAME TO TeamAwards_old;
ALTER TABLE TeamPII RENAME TO TeamPII_old;

/* Create new tables under regular names */
CREATE TABLE Teams (
    TeamID TEXT PRIMARY KEY,
    TeamName TEXT NOT NULL,
    Location TEXT NOT NULL
);

CREATE TABLE TeamLinks (
    TeamID TEXT PRIMARY KEY,
    BuildThread TEXT,
    CAD TEXT,
    Code TEXT,
    Photo TEXT,
    Video TEXT,
    TeamWebsite TEXT
);

CREATE TABLE TeamInfo (
    TeamID TEXT PRIMARY KEY,
    RookieYear INTEGER,
    TeamMembers INTEGER,
    Mentors INTEGER,
    TeamType TEXT,
    MeetingHours INTEGER,
    Budget TEXT,
    Workspace TEXT,
    Sponsors TEXT
);

CREATE TABLE RobotInfo (
    TeamID TEXT PRIMARY KEY,
    Drivetrain TEXT,
    Materials TEXT,
    Products TEXT,
    Systems TEXT,
    Odometry TEXT,
    Sensors TEXT
);

CREATE TABLE CodeInfo (
    TeamID TEXT PRIMARY KEY,
    CodeLang TEXT,
    CodeEnv TEXT,
    CodeTools TEXT,
    Vision TEXT
);

CREATE TABLE FreeResponse (
    TeamID TEXT PRIMARY KEY,
    UniqueFeatures TEXT,
    Outreach TEXT,
    CodeAdvantage TEXT,
    Competitions TEXT,
    TeamStrategy TEXT,
    GameStrategy TEXT,
    DesignProcess TEXT
);

CREATE TABLE TeamAwards (
    rowid INTEGER PRIMARY KEY,
    TeamID TEXT,
    Year INTEGER,
    Award TEXT
);

CREATE TABLE TeamPII (
    TeamID TEXT PRIMARY KEY,
    ContactEmail TEXT,
    ShipAddress TEXT
);

/* Transfer data from old tables to new, modifying TeamNumber to new TeamID */
INSERT INTO Teams (TeamID, TeamName, Location)
SELECT 
    "FTC" || TeamNumber,
    TeamName,
    Location
FROM Teams_old;

INSERT INTO TeamLinks (TeamID, BuildThread, CAD, Code, Photo, Video, TeamWebsite)
SELECT 
    "FTC" || TeamNumber,
    BuildThread,
    CAD,
    Code,
    Photo,
    Video,
    TeamWebsite
FROM TeamLinks_old;

INSERT INTO TeamInfo (TeamID, RookieYear, TeamMembers, Mentors, TeamType, MeetingHours, Budget, Workspace, Sponsors)
SELECT 
    "FTC" || TeamNumber,
    RookieYear,
    TeamMembers,
    Mentors,
    TeamType,
    MeetingHours,
    Budget,
    Workspace,
    Sponsors
FROM TeamInfo_old;

INSERT INTO RobotInfo (TeamID, Drivetrain, Materials, Products, Systems, Odometry, Sensors)
SELECT 
    "FTC" || TeamNumber,
    Drivetrain,
    Materials,
    Products,
    Systems,
    Odometry,
    Sensors
FROM RobotInfo_old;

INSERT INTO CodeInfo (TeamID, CodeLang, CodeEnv, CodeTools, Vision)
SELECT 
    "FTC" || TeamNumber,
    CodeLang,
    CodeEnv,
    CodeTools,
    Vision
FROM CodeInfo_old;

INSERT INTO FreeResponse (TeamID, UniqueFeatures, Outreach, CodeAdvantage, Competitions, TeamStrategy, GameStrategy, DesignProcess)
SELECT 
    "FTC" || TeamNumber,
    UniqueFeatures,
    Outreach,
    CodeAdvantage,
    Competitions,
    TeamStrategy,
    GameStrategy,
    DesignProcess
FROM FreeResponse_old;

INSERT INTO TeamAwards (rowid, TeamID, Year, Award)
SELECT 
    rowid,
    "FTC" || TeamNumber,
    Year,
    Award
FROM TeamAwards_old;

INSERT INTO TeamPII (TeamID, ContactEmail, ShipAddress)
SELECT 
    "FTC" || TeamNumber,
    ContactEmail,
    ShipAddress
FROM TeamPII_old;

/* Delete old tables */
DROP TABLE Teams_old;
DROP TABLE TeamLinks_old;
DROP TABLE TeamInfo_old;
DROP TABLE RobotInfo_old;
DROP TABLE CodeInfo_old;
DROP TABLE FreeResponse_old;
DROP TABLE TeamAwards_old;
DROP TABLE TeamPII_old;