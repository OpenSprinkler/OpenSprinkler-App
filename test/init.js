/* global describe, it, chai, storage */
var assert = chai.assert;

describe("Intial Setup", function(){
	describe("Check if storage is defined", function(){
		it("Should be defined", function(){
			assert.equal("function", typeof storage.get);
			assert.equal("function", typeof storage.set);
			assert.equal("function", typeof storage.remove);
		});
	});
});
