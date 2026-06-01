namespace my.aspects;
using { cuid, managed, temporal } from '@sap/cds/common';

aspect Auditable{
    note        :   String(500);
    isDeleted   :   Boolean default false;
}

entity Books:cuid,managed,Auditable{
    title   :   String(200);
    price   :   Decimal(9,2);
    stock   :   Integer default 0;
    genre   :   String(100);
}

entity Orders:cuid,managed,temporal{
    amount  :   Integer;
    status  :   String(20) default 'pending';
    book    :   Association to Books;
}

extend Books with{
    publisher   :   String(100);
    language    :   String(10) default 'en';
}