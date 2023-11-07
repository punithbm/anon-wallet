import "react-toastify/dist/ReactToastify.css";

import { BigNumber, ethers } from "ethers";
import Lottie from "lottie-react";

import { useRouter } from "next/router";
import { FC, useContext, useEffect, useState } from "react";

import { parseEther } from "viem";
import { getBalance, getRelayTransactionStatus, getSendTransactionStatus, getUsdPrice } from "../../apiServices";
import { GlobalContext } from "../../context/GlobalContext";

import {
  getCurrencyFormattedNumber,
  getTokenFormattedNumber,
  getTokenValueFormatted,
  hexToNumber,
  isValidEOAAddress,
  trimAddress,
} from "../../utils";
import { useWagmi } from "../../utils/wagmi/WagmiContext";
import ReactTyped from "react-typed";
import { createSafe } from "@instadapp/avocado";
import { Button } from "../shared";
import BottomSheet from "../bottom-sheet";
import { TaxAlertBottomSheet, TxStatus } from ".";
import React from "react";

import { IHybridPaymaster, PaymasterMode, SponsorUserOperationDto } from "@biconomy/paymaster";

export interface ILoadChestComponent {
  provider?: any;
}
export const SendTx: FC<ILoadChestComponent> = (props) => {
  const { provider } = props;
  const {
    state: { loggedInVia, address, smartAccount: biconomyWallet },
  } = useContext(GlobalContext);
  const router = useRouter();
  const [value, setValue] = useState("");
  const [price, setPrice] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [tokenPrice, setTokenPrice] = useState("");
  const [tokenValue, setTokenValue] = useState(0);
  const [fromAddress, setFromAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [transactionLoading, setTransactionLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [toggle, setToggle] = useState(true);
  const [btnDisable, setBtnDisable] = useState(true);
  const [balanceInUsd, setBalanceInUsd] = useState("");
  const [showActivity, setShowActivity] = useState(false);
  const [chestLoadingText, setChestLoadingText] = useState("");
  const [txHash, setTxHash] = useState("");
  const [trimTxHash, setTxTrimHash] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [openBottomSheet, setOpenBottomSheet] = useState(false);
  const handleOpenBottomSheet = () => {
    setOpenBottomSheet(true);
  };
  const handleCloseBottomSheet = () => {
    setOpenBottomSheet(false);
  };
  const handleToggle = () => {
    setToggle(!toggle);
  };
  const { sendTransaction } = useWagmi();
  useEffect(() => {
    if (address) {
      fetchBalance();
    }
  }, [address]);
  const fetchBalance = async () => {
    setLoading(true);
    getUsdPrice()
      .then(async (res: any) => {
        // @ts-ignore
        setTokenPrice(res["data"]["matic-network"]["usd"]);
        setFromAddress(address);
        const balance = (await getBalance(address)) as any;
        setTokenValue(getTokenFormattedNumber(hexToNumber(balance.result) as unknown as string, 18));
        // @ts-ignore
        const formatBal = (
          (hexToNumber(balance.result) / Math.pow(10, 18)) *
          res["data"]["matic-network"]["usd"]
        ).toFixed(3);
        setPrice(getCurrencyFormattedNumber(formatBal));
        setBalanceInUsd(formatBal);
        setLoading(false);
      })
      .catch((e) => {
        console.log(e);
      });
  };
  const handleValueClick = (val: string) => {
    setValue(`$${val}`);
    const valueWithoutDollarSign = val.replace(/[^\d.]/g, "");
    const tokenIputValue = Number(valueWithoutDollarSign) / Number(tokenPrice);
    setInputValue(getTokenValueFormatted(Number(tokenIputValue)));
  };
  const handleInputChange = (val: string) => {
    const valueWithoutDollarSign = val.replace(/[^\d.]/g, "");
    let appendDollar = "";
    if (Number(valueWithoutDollarSign) > 0) {
      appendDollar = "$";
    }
    setValue(`${appendDollar}${valueWithoutDollarSign}`);
    const tokenIputValue = Number(valueWithoutDollarSign) / Number(tokenPrice);
    setInputValue(getTokenValueFormatted(Number(tokenIputValue)));
    const isValidAddress = isValidEOAAddress(toAddress);
    console.log(isValidAddress, "isValidAddress");
    if (Number(valueWithoutDollarSign) < Number(balanceInUsd)) {
      setBtnDisable(false);
    } else {
      setBtnDisable(true);
    }
  };
  // const createWallet = async () => {
  //   const _inputValue = inputValue.replace(/[^\d.]/g, "");
  //   if (_inputValue) {
  //     const bgVal = BigNumber.from(parseEther(inputValue));
  //     const ethProvider = new ethers.providers.Web3Provider(provider);
  //     const safe = createSafe(ethProvider.getSigner());
  //     const owner = await safe.getOwnerAddress();
  //     console.log("ethProvider", ethProvider);
  //     console.log("owner", owner);
  //     const safeAddr = await safe.getSafeAddress();
  //     console.log("safeAddr", safeAddr);
  //     console.log("safe", safe);
  //     const signer = safe.getSigner();
  //     console.log("signer", signer);
  //     const signedTx = await signer.sendTransaction({
  //       to: toAddress,
  //       value: 0,
  //       chainId: 137,
  //     });
  //   }
  // };

  const createWallet = async () => {
    const _inputValue = inputValue.replace(/[^\d.]/g, "");
    if (_inputValue) {
      setTransactionLoading(true);
      setChestLoadingText("Initializing...");
      const amount = ethers.utils.parseEther(_inputValue);
      const data = "0x";
      const tx = {
        to: toAddress,
        value: amount,
        data,
      };
      const smartAccount = biconomyWallet;
      let partialUserOp = await smartAccount.buildUserOp([tx]);
      setChestLoadingText("Setting up smart account...");
      const biconomyPaymaster = smartAccount.paymaster as IHybridPaymaster<SponsorUserOperationDto>;
      let paymasterServiceData: SponsorUserOperationDto = {
        mode: PaymasterMode.SPONSORED,
        // optional params...
      };

      try {
        setChestLoadingText("Setting up paymaster...");
        const paymasterAndDataResponse = await biconomyPaymaster.getPaymasterAndData(
          partialUserOp,
          paymasterServiceData
        );
        partialUserOp.paymasterAndData = paymasterAndDataResponse.paymasterAndData;
        const userOpResponse = await smartAccount.sendUserOp(partialUserOp);
        const transactionDetails = await userOpResponse.wait();
        // console.log("transactionDetails", transactionDetails);
        // console.log("txHash", `https://mumbai.polygonscan.com/tx/${transactionDetails.receipt.transactionHash}`);
        setChestLoadingText("Success! Transaction Processed");
        setTimeout(() => {
          setChestLoadingText("Transaction Submitted!");
          setTxHash(`https://mumbai.polygonscan.com/tx/${transactionDetails.receipt.transactionHash}`);
          setTxTrimHash(trimAddress(transactionDetails.receipt.transactionHash));
        }, 2000);
      } catch (error) {
        console.error("Error executing transaction:", error);
      }
    }
  };

  return (
    <>
      {" "}
      <div className="pt-[120px] bg-white h-[100dvh] relative">
        <div className="container mx-auto relative h-full">
          {!transactionLoading ? (
            <div>
              {!showActivity ? (
                <>
                  <div className="w-full">
                    <div className="relative mb-4">
                      <label htmlFor="usdValue" className="label mb-3 block">
                        Amount
                      </label>
                      <div className="relative">
                        <input
                          id="usdValue"
                          name="usdValue"
                          inputMode="decimal"
                          type="text"
                          className={`p-3 heading3_bold border !text-black border-secondary-700 bg-transparent placeholder-grey rounded-xl block w-full focus:outline-none focus:ring-transparent`}
                          placeholder="$0"
                          value={value}
                          onChange={(e) => {
                            handleInputChange(e.target.value);
                          }}
                          disabled={loading}
                          onWheel={() => (document.activeElement as HTMLElement).blur()}
                        />
                        <div className="absolute top-1/2 -translate-y-1/2 right-3">
                          {Number(inputValue) > 0 && (
                            <p className="!text-text-500 paragraph_semibold">~ {inputValue} MATIC </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-3">
                        <div
                          className="border border-secondary-700 px-2 py-[4.5px] rounded-3xl cursor-pointer"
                          role="presentation"
                          onClick={() => {
                            handleValueClick("10");
                          }}
                        >
                          <p className="meta">$10</p>
                        </div>
                        <div
                          className="border border-secondary-700 px-2 py-[4.5px] rounded-3xl cursor-pointer"
                          role="presentation"
                          onClick={() => {
                            handleValueClick("20");
                          }}
                        >
                          <p className="meta">$20</p>
                        </div>
                        <div
                          className="border border-secondary-700 px-2 py-[4.5px] rounded-3xl cursor-pointer"
                          role="presentation"
                          onClick={() => {
                            handleValueClick("50");
                          }}
                        >
                          <p className="meta">$50</p>
                        </div>
                      </div>
                      <p className="meta">
                        {" "}
                        Bal: {tokenValue} MATIC |<span className="meta pl-2">{price}</span>
                      </p>
                    </div>
                  </div>
                  ​
                  <div className="">
                    <label htmlFor="usdValue" className="label mb-3 block">
                      Address
                    </label>
                    <input
                      type="text"
                      id="first_name"
                      className=" border border-secondary-700 text-gray-900 text-sm rounded-xl placeholder-grey block w-full p-3 focus:outline-none focus:ring-transparent"
                      placeholder="Enter recipient address"
                      value={toAddress}
                      onChange={(e) => {
                        setToAddress(e.target.value);
                      }}
                      // onClick={handleOpenBottomSheet}
                    />
                  </div>
                </>
              ) : null}
            </div>
          ) : (
            <div className="w-[full] max-w-[600px] h-full relative flex flex-col text-center items-center gap-5 mx-auto mt-20">
              <ReactTyped
                className="!text-secondary-100 text-[24px]"
                strings={[chestLoadingText]}
                typeSpeed={40}
                loop={true}
              />
              {txHash && (
                <a className="text-purple font-semibold" href={txHash} target="_blank">
                  {trimTxHash}
                </a>
              )}
              {txHash && (
                <a className=" font-semibold" href={"/"} target="">
                  Back to Home
                </a>
              )}
            </div>
          )}
          ​
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full py-4">
            <Button
              className={`!bg-purple !rounded-3xl !text-base !w-[388px] mx-auto ${
                btnDisable || !value ? "" : ""
              } ${!btnDisable && value ? "opacity-100" : "opacity-100"}`}
              variant={"primary"}
              label="Continue"
              onClick={createWallet}
            />
          </div>
        </div>
        <BottomSheet
          isOpen={openBottomSheet}
          onClose={() => {
            setOpenBottomSheet(false);
          }}
        >
          <TaxAlertBottomSheet handleCloseBottomSheet={handleCloseBottomSheet} />
        </BottomSheet>
      </div>
      {/* <TxStatus /> */}
    </>
  );
};
