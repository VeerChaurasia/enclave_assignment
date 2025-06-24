// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import "../src/Unified.sol";

contract DeployScript is Script {
    function run() external {
        // Load deployer's private key from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        // Begin broadcast with this key
        vm.startBroadcast(deployerPrivateKey);

        // Deploy the implementation contract (Counter)
        Unified unified = new Unified();

        // Print deployed address
        console2.log("Counter (implementation) deployed at:", address(unified));

        vm.stopBroadcast();
    }
}
