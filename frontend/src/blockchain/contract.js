
import { ethers } from "ethers";
import artifact from "./CharityDonation.json";

export const CONTRACT_ADDRESS =
  "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
export const CONTRACT_ABI = artifact.abi;

export async function getCharityContract() {
  if (!window.ethereum) {
    throw new Error("Please install MetaMask.");
  }

  const provider = new ethers.BrowserProvider(window.ethereum);

  await provider.send("eth_requestAccounts", []);

  const network = await provider.getNetwork();

  if (network.chainId !== 31337n) {
    throw new Error(
      "Please select Hardhat Local network (Chain ID: 31337)."
    );
  }

  const signer = await provider.getSigner();

  return new ethers.Contract(
    CONTRACT_ADDRESS,
    CONTRACT_ABI,
    signer
  );
}
