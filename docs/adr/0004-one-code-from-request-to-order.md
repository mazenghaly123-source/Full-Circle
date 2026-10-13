# One code from request to order

The code a brand receives when it requests a sample (`FC-####`) becomes its order's code, so the
client keeps one reference for the whole journey. The server issues codes from one database
sequence (never the browser, which could repeat them). If a request becomes more than one order,
the extra orders take a suffix (`FC-2418-B`). A code identifies an order but never grants access to
it; access always comes from being a member of the client.
