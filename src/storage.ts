import { MysqlError, Pool } from 'mysql';


function query(query: string, inputs: any[], callback: (error: MysqlError, result: any[]) => void, pool: Pool) {
    pool.getConnection(function (error, connection) {
        connection.beginTransaction(function (error) {
            if (error) {
                // Transaction Error (Rollback and release connection)
                connection.rollback(function () {
                    connection.release();
                    callback(error, []);
                });
            } else {
                connection.query(query, inputs, function (error, results) {
                    if (error) {
                        // Query Error (Rollback and release connection)
                        connection.rollback(function () {
                            connection.release();
                            callback(error, []);
                        });
                    } else {
                        connection.commit(function (error) {
                            if (error) {
                                connection.rollback(function () {
                                    connection.release();
                                    callback(error, []);
                                });
                            } else {
                                connection.release();
                                callback(error, results);
                            }
                        });
                    }
                });
            }
        });
    });
}

/**
 * @param article Article that will be stored
 * @param pool Connectin pool
 * @description Will only store an article if the uniqueKey is unique in the database.
 */
export function storePrice(priceData, pool: Pool) {
    query(
        'INSERT INTO `ebay-prices`.`mx5` (`price`, `aid`) VALUES (?, ?);',
        [priceData.price, priceData.id],
        (err, result) => {
            if (err) {
                console.log(err);
            }
        },
        pool
    );
}
