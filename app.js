let express = require("express");
let { open } = require("sqlite");
let sqlite3 = require("sqlite3");
let path = require("path");
let bcrypt = require("bcrypt");
let jwt = require("jsonwebtoken");
let app = express();
app.use(express.json());

let db = null;
let dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let initializeDBAndServer = async function () {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, function () {
      console.log("Server is Running at http://localhost:3000/");
    });
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

let authenticationToken = (request, response, next) => {
  let authHeader = request.headers["authorization"];
  let jwtToken;
  if (authHeader != undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "My Secret Token", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

let convertStateDbToResponseDb = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

let convertDistrictDbToResponseDb = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

// Login User API
app.post("/login/", async function (request, response) {
  let { username, password } = request.body;
  let postLoginQuery = `SELECT *
                          FROM user
                          WHERE username= '${username}';
                          `;
  let dbUser = await db.get(postLoginQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    let isMatchPassword = await bcrypt.compare(password, dbUser.password);
    if (isMatchPassword === true) {
      let payload = { username: username };
      let jwtToken = jwt.sign(payload, "My Secret Token");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

app.get("/states/", authenticationToken, async (request, response) => {
  let getStatesQuery = `
                SELECT *
                FROM 
                   state;`;
  let states = await db.all(getStatesQuery);
  response.send(
    states.map((eachState) => convertStateDbToResponseDb(eachState))
  );
});

app.get("/states/:stateId/", authenticationToken, async (request, response) => {
  let { stateId } = request.params;
  let getStatesId = `
        SELECT *
        FROM 
           state
        WHERE 
           state_id = ${stateId};`;
  let stateArray = await db.get(getStatesId);
  response.send(convertStateDbToResponseDb(stateArray));
});

app.post("/districts/", authenticationToken, async (request, response) => {
  let { districtName, stateId, cases, cured, active, deaths } = request.body;
  let postDistrictQuery = `
            INSERT INTO
                district (district_name,state_id,cases,cured,active,deaths)
            VALUES (
                '${districtName}',
                '${stateId}',
                '${cases}',
                '${cured}',
                '${active}',
                '${deaths}'
            );`;
  let district = await db.run(postDistrictQuery);
  response.send("District Successfully Added");
});

app.get(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    let { districtId } = request.params;
    let getDistrictById = `
        SELECT *
        FROM
            district
        WHERE
            district_id = '${districtId}';`;
    let array = await db.get(getDistrictById);
    response.send(convertDistrictDbToResponseDb(array));
  }
);
app.delete(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    let { districtId } = request.params;
    let getDistrictById = `
        DELETE 
        FROM
            district
        WHERE
            district_id = '${districtId}';`;
    let deleteArray = await db.get(getDistrictById);
    response.send("District Removed");
  }
);

app.put(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    let { districtId } = request.params;
    let { districtName, stateId, cases, cured, active, deaths } = request.body;
    let putDistrictQuery = `
        UPDATE 
           district
        SET 
        district_name = '${districtName}',
        state_id = '${stateId}',
        cases = '${cases}',
        cured = '${cured}',
        active = '${active}',
        deaths = '${deaths}';`;
    let query = await db.run(putDistrictQuery);
    response.send("District Details Updated");
  }
);

app.get(
  "/states/:stateId/stats/",
  authenticationToken,
  async (request, response) => {
    let { stateId } = request.params;
    let getStateByIdQuery = `
            SELECT 
                SUM(cases),
                SUM(cured),
                SUM(active),
                SUM(deaths)
            FROM 
                district
            WHERE
                state_id = '${stateId}';`;
    let statesArray = await db.get(getStateByIdQuery);
    response.send({
      totalCases: statesArray["SUM(cases)"],
      totalCured: statesArray["SUM(cured)"],
      totalActive: statesArray["SUM(active)"],
      totalDeaths: statesArray["SUM(deaths)"],
    });
  }
);

module.exports = app;
