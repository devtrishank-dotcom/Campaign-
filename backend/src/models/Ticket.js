import mongoose from "mongoose";

export const TICKET_STATUS = ["open", "in_progress", "resolved", "closed"];
export const TICKET_PRIORITY = ["low", "normal", "high", "urgent"];

const replySchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    authorName: { type: String, default: "" },
    isStaff: { type: Boolean, default: false },
    message: { type: String, required: true },
  },
  { timestamps: true }
);

const ticketSchema = new mongoose.Schema(
  {
    ticketNo: { type: Number },
    subject: { type: String, required: true, trim: true },
    message: { type: String, required: true },
    category: { type: String, default: "general" },
    priority: { type: String, enum: TICKET_PRIORITY, default: "normal" },
    status: { type: String, enum: TICKET_STATUS, default: "open" },
    requester: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    requesterName: { type: String, default: "" },
    requesterEmail: { type: String, default: "" },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    replies: { type: [replySchema], default: [] },
    closedAt: { type: Date, default: null },
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

ticketSchema.index({ owner: 1, status: 1, createdAt: -1 });
ticketSchema.index({ requester: 1, createdAt: -1 });

export const Ticket = mongoose.model("Ticket", ticketSchema);
