
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CharityDonation Smart Contract", function () {

    let charity;
    let owner;
    let beneficiary;
    let donor;

    beforeEach(async function () {

        [owner, beneficiary, donor] =
            await ethers.getSigners();

        const CharityDonation =
            await ethers.getContractFactory("CharityDonation");

        charity = await CharityDonation.deploy();

        await charity.waitForDeployment();
    });

    it("Should create a charity campaign", async function () {

        await charity.createCampaign(
            "Education Support",
            "Help poor students",
            beneficiary.address,
            ethers.parseEther("2"),
            7
        );

        const campaign =
            await charity.getCampaignDetails(1);

        expect(campaign.title).to.equal("Education Support");
        expect(campaign.beneficiary).to.equal(beneficiary.address);
    });

    it("Should accept donations", async function () {

        await charity.createCampaign(
            "Medical Support",
            "Help patients",
            beneficiary.address,
            ethers.parseEther("2"),
            7
        );

        await charity.connect(donor).donate(1, {
            value: ethers.parseEther("1")
        });

        const donation =
            await charity.getDonation(1, donor.address);

        expect(donation).to.equal(ethers.parseEther("1"));
    });

    it("Should track total donations", async function () {

        await charity.createCampaign(
            "Food Donation",
            "Help poor families",
            beneficiary.address,
            ethers.parseEther("2"),
            7
        );

        await charity.connect(donor).donate(1, {
            value: ethers.parseEther("1")
        });

        const campaign =
            await charity.getCampaignDetails(1);

        expect(campaign.raised).to.equal(
            ethers.parseEther("1")
        );
    });

    it("Should allow beneficiary to withdraw after goal is reached",
        async function () {

        await charity.createCampaign(
            "Emergency Help",
            "Support families",
            beneficiary.address,
            ethers.parseEther("2"),
            7
        );

        await charity.connect(donor).donate(1, {
            value: ethers.parseEther("2")
        });

        await charity.connect(beneficiary).withdrawFunds(1);

        const campaign =
            await charity.getCampaignDetails(1);

        expect(campaign.withdrawn).to.equal(true);
    });

    it("Should allow donors to claim refunds after failed campaigns",
        async function () {

        await charity.createCampaign(
            "Community Help",
            "Help our community",
            beneficiary.address,
            ethers.parseEther("2"),
            1
        );

        await charity.connect(donor).donate(1, {
            value: ethers.parseEther("1")
        });

        await ethers.provider.send("evm_increaseTime", [86401]);
        await ethers.provider.send("evm_mine", []);

        await charity.connect(donor).claimRefund(1);

        const donation =
            await charity.getDonation(1, donor.address);

        expect(donation).to.equal(0);
    });

});
