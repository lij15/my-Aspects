const cds = require('@sap/cds')

module.exports = class CatalogService extends cds.ApplicationService {
    async init(){
        const {Books,Orders} = this.entities

        // cuid: No ID needs to be passed during creation; 
        // CAP automatically generates the UUID.
        this.before('CREATE',Books,req => {
            console.log('CREATE before req.data',req.data)
        })

        this.after('CREATE',Books,book => {
            console.log('CREATE after Automatically generated UUID',book.ID)
        })

        //managed: createdAt/modifiedAt auto-fill
        //No manual setting is required; CAP handles this automatically during writes
        this.after('READ',Books,books => {
            if(!books) return
            const list = Array.isArray(books) ? books : [books]
            for(const book of list) {
                console.log(`《${book.title}》createdAt: ${book.createdAt}`)
                console.log(`《${book.title}》modifiedAt: ${book.modifiedAt}`)
            }
        })

        // Instead of actually deleting, simply set isDeleted to true.
        this.on('DELETE',Books,async req => {
            const id = req.params[0].ID
            console.log('Logical deletion book ID：',id)

            const result = await UPDATE(Books)
                .set({isDeleted:true})
                .where({ID:id})
            
            console.log('UPDATE result:', result)

            const book = await SELECT.one.from(Books).where({ ID: id })
            console.log('after update book:', book)
            
            return req.reply()
        })

        this.before('READ',Books,req => {
            //req.query.where({isDeleted:false})
        })

        this.after('READ',Books,books => {
            if(!books) return
            const list = Array.isArray(books) ? books : [books]
            for(const book of list) {
                book.displayName = `${book.title} (${book.language?.toUpperCase()})`
            }
        })

        return super.init()
    }    
}