"use client";

import React from 'react';
import { Card } from './ui/card';
import { Avatar } from './ui/avatar';
import { CheckCircle2, XCircle, Clock } from "lucide-react";

type DriverStatus = "waiting" | "en-route" | "arrived";

interface DriverCardProps {
  driverName: string;
  vehicleNumber: string;
  eta: string;
  status: DriverStatus;
}

export const DriverCard = ({
  driverName,
  vehicleNumber,
  eta,
  status,
}: DriverCardProps) => {
  return (
    <div className="fixed bottom-4 left-4 z-50 bg-white rounded-lg shadow-lg p-4 min-w-[300px] border-l-4 border-red-500">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">{driverName}</h3>
          <p className="text-sm text-gray-500">{vehicleNumber}</p>
        </div>
        <StatusIcon status={status} />
      </div>
      <div className="mt-3 flex items-center space-x-2">
        <Clock className="w-4 h-4 text-gray-400" />
        <span className="text-sm font-medium text-gray-600">
          ETA: {eta}
        </span>
      </div>
      <div className="mt-2">
        <StatusBar status={status} />
      </div>
    </div>
  );
};

const StatusIcon = ({ status }: { status: DriverStatus }) => {
  switch (status) {
    case "arrived":
      return <CheckCircle2 className="w-6 h-6 text-green-500" />;
    case "en-route":
      return <Clock className="w-6 h-6 text-yellow-500 animate-pulse" />;
    case "waiting":
      return <XCircle className="w-6 h-6 text-red-500" />;
  }
};

const StatusBar = ({ status }: { status: DriverStatus }) => {
  const getWidth = () => {
    switch (status) {
      case "waiting":
        return "w-1/3";
      case "en-route":
        return "w-2/3";
      case "arrived":
        return "w-full";
    }
  };

  const getColor = () => {
    switch (status) {
      case "waiting":
        return "bg-red-500";
      case "en-route":
        return "bg-yellow-500";
      case "arrived":
        return "bg-green-500";
    }
  };

  return (
    <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
      <div
        className={`h-full ${getWidth()} ${getColor()} transition-all duration-500 ease-in-out`}
      />
    </div>
  );
};
