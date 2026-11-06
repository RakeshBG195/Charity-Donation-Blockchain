
const { ethers } = require("hardhat");

async function main() {

    const [deployer] = await ethers.getSigners();

    console.log("Deploying Charity Donation Contract...");
    console.log("Deployer address:", deployer.address);

    const CharityDonation =
        await ethers.getContractFactory("CharityDonation");

    const charity = await CharityDonation.deploy();

    await charity.waitForDeployment();

    const contractAddress = await charity.getAddress();

    console.log("--------------------------------");
    console.log("Contract deployed successfully!");
    console.log("Contract Address:", contractAddress);
    console.log("--------------------------------");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
