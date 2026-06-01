using { my.aspects as db } from '../db/schema';

service CatalogService {

    entity Books as projection on db.Books;
    entity Orders as projection on db.Orders;

}