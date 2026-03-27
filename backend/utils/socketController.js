let connectedUsers = [];

exports.handleSetup = (socket) => {
  socket.on('setup', (user) => {
    connectedUsers.push(user);
    socket.user_id = user;
    socket.join(user);
    socket.emit('connected');
  });
  socket.on('disconnect', () => {
    connectedUsers = connectedUsers.filter((user) => user !== socket.user_id);
    socket.to(socket.chat_id).emit('user_online_status', false);
  });
};

exports.handleJoinChat = (socket) => {
  socket.on('join_room', ({ room, users }) => {
    socket.chat_id = room;
    socket.join(room);
    users = users.map((user) => {
      return user.id;
    });
    const online = users.every((v) => connectedUsers.includes(v));
    socket.emit('user_online_status', online);
    socket.to(room).emit('user_online_status', online);
  });
  socket.on('leave_room', (room) => {
    socket.leave(room);
  });
};

exports.handleMessage = (socket) => {
  socket.on('new_message', (message) => {
    let chat = message.chat;
    if (!chat.users) {
      return 
    }
    chat.users.forEach((user) => {
      if (user.id == message.sender.id) {
        return;
      }
      socket.to(user.id).emit('new_message_recieved', message);
    });
  });
};

exports.handleTyping = (socket) => {
  socket.on('typing', (room) => {
    socket.to(room).emit('typing');
  });
  socket.on('stop_typing', (room) => {
    socket.to(room).emit('stop_typing');
  });
};
