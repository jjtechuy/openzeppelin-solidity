const { BN, ether, expectRevert, time } = require('openzeppelin-test-helpers');

const { expect } = require('chai');

const PostDeliveryCrowdsaleImpl = artifacts.require('PostDeliveryCrowdsaleImpl');
const SimpleToken = artifacts.require('SimpleToken');

contract.skip('PostDeliveryCrowdsale', function ([_, investor, wallet, purchaser]) {
  const rate = new BN(1);
  const tokenSupply = new BN('10').pow(new BN('22'));

  before(async function () {
    // Advance to the next block to correctly read time in the solidity "now" function interpreted by ganache
    await time.advanceBlock();
  });

  beforeEach(async function () {
    this.openingTime = (await time.latest()).add(time.duration.weeks(1));
    this.closingTime = this.openingTime.add(time.duration.weeks(1));
    this.afterClosingTime = this.closingTime.add(time.duration.seconds(1));
    this.token = await SimpleToken.new();
    this.crowdsale = await PostDeliveryCrowdsaleImpl.new(
      this.openingTime, this.closingTime, rate, wallet, this.token.address
    );
    await this.token.transfer(this.crowdsale.address, tokenSupply);
  });

  context('after opening time', function () {
    beforeEach(async function () {
      await time.increaseTo(this.openingTime);
    });

    context('with bought tokens', function () {
      const value = ether('42');

      beforeEach(async function () {
        await this.crowdsale.buyTokens(investor, { value: value, from: purchaser });
      });

      it('does not immediately assign tokens to beneficiaries', async function () {
        expect(await this.crowdsale.balanceOf(investor)).to.be.bignumber.equal(value);
        expect(await this.token.balanceOf(investor)).to.be.bignumber.equal('0');
      });

      it('does not allow beneficiaries to withdraw tokens before crowdsale ends', async function () {
        await expectRevert(this.crowdsale.withdrawTokens(investor),
          'PostDeliveryCrowdsale: not closed'
        );
      });

      context('after closing time', function () {
        beforeEach(async function () {
          await time.increaseTo(this.afterClosingTime);
        });

        it('allows beneficiaries to withdraw tokens', async function () {
          await this.crowdsale.withdrawTokens(investor);
          expect(await this.crowdsale.balanceOf(investor)).to.be.bignumber.equal('0');
          expect(await this.token.balanceOf(investor)).to.be.bignumber.equal(value);
        });

        it('rejects multiple withdrawals', async function () {
          await this.crowdsale.withdrawTokens(investor);
          await expectRevert(this.crowdsale.withdrawTokens(investor),
            'PostDeliveryCrowdsale: beneficiary is not due any tokens'
          );
        });
      });
    });
  });
});
