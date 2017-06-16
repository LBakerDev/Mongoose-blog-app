const chai = require('chai');
const chaiHttp = require('chai-http');
const mongoose = require('mongoose');
const faker = require('faker');

//this makes the should syntax available throughout
//this module
const should = chai.should();

const {DATABASE_URL} = require('../config');
const {Posts} = require('../models');
const {app, runServer, closeServer} = require('../server');
const {TEST_DATABASE_URL} = require('../config');

chai.use(chaiHttp);

//this function deletes the entire database
// we'll call it in an 'afterEach' block below
// 
function tearDownDb() {
    return new Promise((resolve, reject) => {
    console.warn('Deleting database');
    mongoose.connection.dropDatabase()
        .then(result => resolve(result))
        .catch(err => reject(err))
});

function seedBlogData() {
    console.info('seeding blog data');
    const seedData =[];

    for (let i=1; i<=10; i++) {
        seedData.push({
            author: {
                firstName: faker.name.firstName(),
                lastName: faker.name.lastName()
            },
            title: faker.lorem.sentence(),
            content: faker.lorem.text()
        });
    }
    // this will return a promise
    return Posts.insertMany(seedData);
}

describe('blog posts API resource', function() {
    
    before(function() {
        return runServer(TEST_DATABASE_URL);
    });

    beforeEach(function() {
        return seedBlogData();
    })

    afterEach(function() {
        // tear down db so we ensure no state from this test
        // effects any coming after
        return tearDownDb();
    });

    after(function() {
        return closeServer();
    });

    describe('GET endpoint', function() {
        
        it('should return all existing blogposts', function() {
            //strategy:
            //  1. get back all blogposts returned by GET request to '/blogposts'
            //  2. prove res has right status, data type
            //  3. prove the number of blogposts we get back is equal to number in db.

            //need to have access to mutate and access 'res' across
            //'.then' calls below. So we delare it here so we can modify in place

            let res;
            return chai.request(app)
                .get('/blogposts')
                .then(function(_res) {
                    // so subsequent .then blocks can access resp obj
                    res = _res;
                    res.should.have.status(200);
                    //otherwise our db seeding didn't work
                    res.body.blogposts.should.have.length.of.at.least(1);
                    return Posts.count();
                })
                .then(function(count) {
                    res.body.should.have.length.of(count);

                });
            });

            it('should return blogposts with right fields', function() {
                // Strategy: Get back all blogposts and ensure they have expected keys

                let resBlogPosts;
                return chai.request(app)
                .get('/blogposts')
                .then(function(res) {

                    res.should.have.status(200);
                    res.should.be.json;
                    res.body.should.be.a('array');
                    res.body.should.have.length.of.at.least(1);

                    res.body.blogposts.forEach(function(blogPost) {
                        blogPost.should.be.a('object');
                        blogPost.should.include.keys('id', 'title', 'content', 'author', 'created');
                    });
                    // just check one of the posts that its values match with those in db
                    // and we'll assume its true for rest
                    resBlogPosts = res.body.blogposts[0];
                    return Posts.findById(resBlogPosts.id);
                })
                .then(function(blogposts) {

                    resBlogPosts.title.should.equal(blogposts.title);
                    resBlogPosts.content.should.equal(blogposts.content);
                    resBlogPosts.author.should.equal(post.authorName);
                });
                });
            });

            describe('POST endpoint', function() {
                //strategy: make a POST request with data,
                // then prove that the blogpost we get back
                // has the right keys and that 'id' is there (which means
                //the date was insterted into db)
                it('should be a new blogpost', function() {

                    const newBlogPost = {
                        title: faker.lorem.sentence(),
                        author: {
                            firstName: faker.name.firstName(),
                            lastName: faker.name.lastName(),
                        },
                        content: faker.lorem.text()
                    };
                    
                    return chai.request(app)
                    .post('/blogposts')
                    .send(newBlogPost)
                    .then(function(res) {
                        res.should.have.status(201);
                        res.should.be.json;
                        res.should.be.a.apply('object');
                        res.body.should.include.keys('id', 'title', 'content', 'author', 'created');
                            res.body.title.should.equal(newBlogPost.title);
                            // cause Mongo should have created id on insertion
                            res.body.id.should.not.be.null
                            res.body.author.should.equal(
                                `${newBlogPost.author.firstName} ${newBlogPost.author.lastName}`);
                                res.body.content.should.equal(newBlogPost.content);
                                return Posts.findById(res.body.id).exec();
                    })
                    .then(function(post) {
                        post.title.should.equal(newBlogPost.title);
                        post.content.should.equal(newBlogPost.content);
                        post.author.firstName.should.equal(newBlogPost.author.firstName);
                        post.author.lastName.should.equal(newBlogPost.author.lastName);
                    });
                            
                    });
                    
                });
                
                 describe('PUT endpoint', function() {

                    // strategy:
                    // 1. Get an existing blogpost from db
                    // 2. Make PUT request to update that restaurant
                    // 3. Prove blogspot returned by request contains we sent
                    // 4. Prove restaurant in db is correctly updated

                    it('should update fields you send over', function() {
                        const updateData = {
                            title: 'cats cats cats',
                            content: 'dogs dogs dogs',
                            author: {
                                firstName: 'foo',
                                lastName: 'bar'
                            }
                    };

                    return Posts
                    .findOne()
                    .exec()
                    .then(post => {
                        updateData.id = post.id;

                        return chai.request(app)
                        .put(`/blogposts/${post.id}`)
                        .send(updateData);
                    })
                    .then(res => {
                        res.should.have.status(201);
                        res.should.be.json;
                        res.body.should.be.a('object');
                        res.body.title.should.equal(updateData.title);
                        res.body.author.should.equal(
                            `${updateData.author.firstName} ${updateData.author.lastName}`);
                            res.body.content.should.equal(updateData.content);

                            return Posts.findById(res.body.id).exec();
                    })
                    .then(post => {
                        post.title.should.equal(updateData.title);
                        post.content.should.equal(updateData.content);
                        post.author.firstName.should.equal(updateData.author.firstName);
                        post.author.lastName.should.equal(updateData.author.lastName);
                    });
                    });
                });

                describe('DELETE endpoint', function() {
                    //strategy:
                    // 1. get a post
                    // 2. make a DELETE request for that post's id
                    // 3. assert that response has right status code
                    // 4. prove that post with the id doesn't exist in db anymore

                    it('should delete a post by id', function() {

                        let post;

                        return Posts
                        .findOne()
                        .exec()
                        .then(_post => {
                            post = _post;
                            return chai.request(app).delete(`/blogposts/${post.id}`);
                        })
                        .then(res => {
                            res.should.have.status(204);
                            return Posts.findById(post.id);
                        })
                        .then(_post => {
                            should.not.exist(_post);
                        });
                    });
                });
});

               


             