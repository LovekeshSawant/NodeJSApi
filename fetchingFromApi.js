const express = require('express');
const mysql = require('mysql');

const app = express();

// Connection to database
const con = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'nodeapitask'
});

con.connect(function(err) {
  if (err) {
    console.log("Error while connecting to database", err);
    return;
  } else {
    console.log("Connection successful");
  }
});

// Fetching data from API "https://s3.amazonaws.com/roxiler.com/product_transaction.json"
async function getData() 
{
  try 
  {
    const data = await fetch('https://s3.amazonaws.com/roxiler.com/product_transaction.json');
    const response = await data.json();

    con.query("truncate table dummy", function(error)
    {
        if(error)
        {
          console.error("Error", error);
          return;
        }
    });

    for (let i = 0; i < response.length; i++) 
    {
      const id = response[i]['id'];
      const title = response[i]['title'];
      const price = response[i]['price'];
      const description = response[i]['description'];
      const category = response[i]['category'];
      const image = response[i]['image'];
      const sold = response[i]['sold'];
      const dateofsale = response[i]['dateOfSale'];

      const insertSql = 'INSERT INTO dummy (id , title, price , description, category, image, sold, dateofsale) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
      const insertValues = [id, title, price, description, category, image, sold, dateofsale];

      con.query(insertSql, insertValues, function(error, results) 
      {
        if (error) 
        {
          console.error('Error inserting products:', error);
          return;
        } 
      });
    }
  } catch (error) 
  {
    console.error('Error fetching data:', error);
  }
}

getData();

// 1) API to list the all transactions
app.get("/api/allRecords/:m", (req, res) => 
{
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  const offset = (page - 1) * limit;

  con.query("SELECT * FROM dummy WHERE MONTH(dateofsale) = "+req.params.m, (err, result) => 
  {
      if (err) 
      {
          console.error('Error fetching records:', err);
          return;
      }
      let filteredRecords = [];
      const search = req.query.search || '';

      if(search != "")
      {
        filteredRecords = result.filter((record) => 
          {
              if(record.title.toLowerCase().includes(search.toLowerCase()))
              {
                return record;
              } else
              if(record.description.toLowerCase().includes(search.toLowerCase()))
              {
                return record;
              } else
              if(record.price == search)
              {
                return record;
              }
          }
        );
      } else 
      {
        filteredRecords = result;
      }

      const paginatedRecords = filteredRecords.slice(offset, offset + limit);

      const totalCount = filteredRecords.length;
      const totalPages = Math.ceil(totalCount / limit);

      const response = {
          totalRecords: totalCount,
          totalPages: totalPages,
          currentPage: page,
          records: paginatedRecords
      };

      res.json(response);
  });
});

// 2) API for statistics
app.get("/api/statistics/:m", (req, res) => 
{
    let sql1 = "SELECT SUM(CASE WHEN sold = 1 THEN price ELSE 0 END) AS totalSaleAmount, SUM(sold = 1) AS TotalSoldItems, SUM(sold = 0) AS TotalUnSoldItems FROM dummy WHERE MONTH(dateofsale) ="+req.params.m+" GROUP BY MONTH(dateofsale)";
    
    let query1 = con.query(sql1, (err, result) => 
    {
        if(err) throw err;
        res.send(result);
    });
});

// 3) API fro Bar Diagram
app.get("/api/dataForBarChart/:m", (req, res) =>
{

    let sql = "SELECT priceRange, COUNT(*) AS itemCount FROM ( SELECT CASE "+
    "WHEN price >= 0 AND price <= 100 THEN '0 - 100' "+
    "WHEN price >= 101 AND price <= 200 THEN '101 - 200' "+
    "WHEN price >= 201 AND price <= 300 THEN '201 - 300' "+
    "WHEN price >= 301 AND price <= 400 THEN '301 - 400' "+
    "WHEN price >= 401 AND price <= 500 THEN '401 - 500' "+
    "WHEN price >= 501 AND price <= 600 THEN '501 - 600' "+
    "WHEN price >= 601 AND price <= 700 THEN '601 - 700' "+
    "WHEN price >= 701 AND price <= 800 THEN '701 - 800' "+
    "WHEN price >= 801 AND price <= 900 THEN '801 - 900' "+
    "ELSE '901-above' END AS priceRange FROM dummy WHERE MONTH(dateofsale) = 10 ) AS priceRanges GROUP BY priceRange ORDER BY priceRange";

    let query = con.query(sql, (err, result) =>
    {
        if(err) throw err;
        res.send(result);
    });

});

// 4) API for pie chart
app.get("/api/dataForPieChart/:m", (req, res) =>
{
    let sql = "SELECT category AS Category, COUNT(category) AS NumberOfItems FROM dummy WHERE MONTH(dateofsale) ="+req.params.m+" GROUP BY category";

    let query = con.query(sql, (err, result) =>
    {
        if(err) throw err;
        res.send(result);
    });

});

// 5) API for Combined Result
app.get("/api/combined/:m", async (req, res) =>
{

    const data1 = await fetch("http://localhost:3000/api/statistics/"+req.params.m);
    const response1 = await data1.json();
    const data2 = await fetch("http://localhost:3000/api/DataForBarChart/"+req.params.m);
    const response2 = await data2.json();
    const data3 = await fetch("http://localhost:3000/api/DataForPieChart/"+req.params.m);
    const response3 = await data3.json();

    const combinedData = 
    {
      statistics: response1,
      DataForBarChart: response2,
      DataForPieChart: response3
    };

    res.json(combinedData);
});




app.listen(3000, () => 
{
  console.log("Server started on port 3000");
});

process.on('exit', () => 
{
  console.log('Closing MySQL connection');
  con.end();
});