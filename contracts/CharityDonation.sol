
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract CharityDonation {

    address public owner;
    uint256 public campaignCount;

    struct Campaign {
        uint256 id;
        string title;
        string description;
        address creator;
        address beneficiary;
        uint256 goal;
        uint256 raised;
        uint256 deadline;
        bool withdrawn;
    }

    mapping(uint256 => Campaign) public campaigns;

    // Campaign ID => Donor address => Donation amount
    mapping(uint256 => mapping(address => uint256))
        public donations;

    // Reentrancy protection
    bool private locked;

    event CampaignCreated(
        uint256 indexed campaignId,
        address indexed creator,
        address indexed beneficiary,
        uint256 goal
    );

    event DonationReceived(
        uint256 indexed campaignId,
        address indexed donor,
        uint256 amount
    );

    event FundsWithdrawn(
        uint256 indexed campaignId,
        address indexed beneficiary,
        uint256 amount
    );

    event RefundIssued(
        uint256 indexed campaignId,
        address indexed donor,
        uint256 amount
    );

    modifier nonReentrant() {
        require(!locked, "Transaction already processing");
        locked = true;
        _;
        locked = false;
    }

    constructor() {
        owner = msg.sender;
    }

    // Create a new charity campaign
    function createCampaign(
        string memory _title,
        string memory _description,
        address _beneficiary,
        uint256 _goal,
        uint256 _durationDays
    ) public {

        require(bytes(_title).length > 0, "Title required");
        require(_beneficiary != address(0), "Invalid beneficiary");
        require(_goal > 0, "Goal must be greater than zero");
        require(_durationDays > 0, "Invalid duration");

        campaignCount++;

        campaigns[campaignCount] = Campaign({
            id: campaignCount,
            title: _title,
            description: _description,
            creator: msg.sender,
            beneficiary: _beneficiary,
            goal: _goal,
            raised: 0,
            deadline: block.timestamp + (_durationDays * 1 days),
            withdrawn: false
        });

        emit CampaignCreated(
            campaignCount,
            msg.sender,
            _beneficiary,
            _goal
        );
    }

    // Donate ETH to a campaign
    function donate(uint256 _campaignId)
        public
        payable
    {
        Campaign storage campaign = campaigns[_campaignId];

        require(_campaignId > 0 && _campaignId <= campaignCount,
            "Campaign does not exist");

        require(block.timestamp < campaign.deadline,
            "Campaign has ended");

        require(!campaign.withdrawn, "Campaign already withdrawn");

        require(campaign.raised < campaign.goal,
            "Campaign goal already reached");

        require(msg.value > 0, "Donation must be greater than zero");

        require(
            msg.value <= campaign.goal - campaign.raised,
            "Donation exceeds remaining goal"
        );

        donations[_campaignId][msg.sender] += msg.value;

        campaign.raised += msg.value;

        emit DonationReceived(
            _campaignId,
            msg.sender,
            msg.value
        );
    }

    // Withdraw funds after reaching the goal
    function withdrawFunds(uint256 _campaignId)
        public
        nonReentrant
    {
        Campaign storage campaign = campaigns[_campaignId];

        require(_campaignId > 0 && _campaignId <= campaignCount,
            "Campaign does not exist");

        require(msg.sender == campaign.beneficiary,
            "Only beneficiary can withdraw");

        require(campaign.raised >= campaign.goal,
            "Funding goal not reached");

        require(!campaign.withdrawn,
            "Funds already withdrawn");

        uint256 amount = campaign.raised;

        campaign.withdrawn = true;

        (bool success, ) = payable(campaign.beneficiary).call{
            value: amount
        }("");

        require(success, "Transfer failed");

        emit FundsWithdrawn(
            _campaignId,
            campaign.beneficiary,
            amount
        );
    }

    // Refund donors if the campaign fails
    function claimRefund(uint256 _campaignId)
        public
        nonReentrant
    {
        Campaign storage campaign = campaigns[_campaignId];

        require(_campaignId > 0 && _campaignId <= campaignCount,
            "Campaign does not exist");

        require(block.timestamp >= campaign.deadline,
            "Campaign is still active");

        require(campaign.raised < campaign.goal,
            "Campaign goal was reached");

        uint256 amount = donations[_campaignId][msg.sender];

        require(amount > 0, "No donation to refund");

        donations[_campaignId][msg.sender] = 0;

        campaign.raised -= amount;

        (bool success, ) = payable(msg.sender).call{value: amount}("");

        require(success, "Refund failed");

        emit RefundIssued(
            _campaignId,
            msg.sender,
            amount
        );
    }

    // View campaign details
    function getCampaignDetails(uint256 _campaignId)
        public
        view
        returns (Campaign memory)
    {
        require(_campaignId > 0 && _campaignId <= campaignCount,
            "Campaign does not exist");

        return campaigns[_campaignId];
    }

    // Check individual donor contribution
    function getDonation(
        uint256 _campaignId,
        address _donor
    ) public view returns (uint256) {

        return donations[_campaignId][_donor];
    }
}
